import { NextResponse } from "next/server";
import {
  ParsedMedicationSchema,
  PharmacistDecisionSchema,
} from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase";
import { z } from "zod";

const MedicationsListSchema = z.array(ParsedMedicationSchema);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const rawBody = await request.json();
    const parsed = PharmacistDecisionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные решения фармацевта" },
        { status: 400 },
      );
    }

    const { decision, pharmacistNote } = parsed.data;
    const nextStatus = decision === "approve" ? "approved" : "rejected";

    const n8nApproveUrl = process.env.N8N_APPROVE_WEBHOOK_URL;
    if (n8nApproveUrl) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (process.env.N8N_WEBHOOK_SECRET) {
          headers["x-webhook-secret"] = process.env.N8N_WEBHOOK_SECRET;
        }

        const n8nRes = await fetch(n8nApproveUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            order_id: id,
            decision,
            status: nextStatus,
            pharmacist_note: pharmacistNote,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (n8nRes.ok) {
          return NextResponse.json({
            id,
            status: nextStatus,
            pharmacist_note: pharmacistNote || null,
            source: "n8n",
          });
        }
      } catch {
      }
    }

    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          status: nextStatus,
          pharmacist_note: pharmacistNote || null,
        })
        .eq("id", id)
        .eq("status", "pending_approval")
        .select("id, status, medications")
        .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          { error: "Не удалось обновить статус заказа в Supabase" },
          { status: 500 },
        );
      }

      if (!updatedOrder) {
        return NextResponse.json(
          { error: "Заказ уже обработан или не найден" },
          { status: 409 },
        );
      }

      if (decision === "approve") {
        const medsParsed = MedicationsListSchema.safeParse(
          updatedOrder.medications,
        );
        if (medsParsed.success) {
          const medicationIds = medsParsed.data
            .filter((med) => med.in_stock && med.matched_medication_id)
            .map((med) => med.matched_medication_id as string);

          if (medicationIds.length > 0) {
            const { data: currentMeds } = await supabase
              .from("medications")
              .select("id, stock_qty")
              .in("id", medicationIds);

            if (currentMeds) {
              await Promise.all(
                currentMeds.map((med) =>
                  supabase
                    .from("medications")
                    .update({ stock_qty: Math.max(0, med.stock_qty - 1) })
                    .eq("id", med.id),
                ),
              );
            }
          }
        }
      }
    }

    return NextResponse.json({
      id,
      status: nextStatus,
      pharmacist_note: pharmacistNote || null,
      source: supabase ? "supabase" : "demo",
    });
  } catch {
    return NextResponse.json(
      { error: "Ошибка при сохранении решения фармацевта" },
      { status: 500 },
    );
  }
}
