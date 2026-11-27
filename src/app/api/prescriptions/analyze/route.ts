import { NextResponse } from "next/server";
import {
  AnalyzePrescriptionRequestSchema,
  PrescriptionAnalysisResultSchema,
  type MedicationInventoryItem,
  type PrescriptionAnalysisResult,
} from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase";
import { DEMO_INVENTORY, MEDICAL_DISCLAIMER_RU } from "@/lib/mock-data";
import { buildDemoAnalysis, buildOrderCode } from "@/lib/demo-analyzer";
import { analyzeWithOpenRouterFallback } from "@/lib/openrouter";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = AnalyzePrescriptionRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Проверьте корректность заполненных полей формы",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    if (!input.prescriptionText && !input.imageDataUrl) {
      return NextResponse.json(
        {
          error: "Добавьте текст рецепта или загрузите фотографию бланка",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    let inventory: MedicationInventoryItem[] = DEMO_INVENTORY;

    if (supabase) {
      const { data } = await supabase
        .from("medications")
        .select(
          "id, name, active_ingredient, dosage, price_kzt, stock_qty, requires_prescription",
        )
        .order("name");

      if (data && data.length > 0) {
        inventory = data;
      }
    }

    const n8nWebhookUrl = process.env.N8N_ANALYZE_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (process.env.N8N_WEBHOOK_SECRET) {
          headers["x-webhook-secret"] = process.env.N8N_WEBHOOK_SECRET;
        }

        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            patient_name: input.patientName,
            patient_phone: input.patientPhone,
            allergies: input.allergies || "Не указаны",
            prescription_text: input.prescriptionText,
            image_data_url: input.imageDataUrl,
            inventory,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (n8nResponse.ok) {
          const n8nPayload = await n8nResponse.json();
          const normalized = PrescriptionAnalysisResultSchema.safeParse({
            ...n8nPayload,
            order_id: n8nPayload.order_id ?? crypto.randomUUID(),
            order_code: n8nPayload.order_code ?? buildOrderCode(),
            source: "n8n",
            patient_name: n8nPayload.patient_name ?? input.patientName,
            patient_phone: n8nPayload.patient_phone ?? input.patientPhone,
            allergies:
              n8nPayload.allergies ?? (input.allergies || "Не указаны"),
            disclaimer: n8nPayload.disclaimer ?? MEDICAL_DISCLAIMER_RU,
            created_at: n8nPayload.created_at ?? new Date().toISOString(),
          });

          if (normalized.success) {
            return NextResponse.json(normalized.data, { status: 200 });
          }
        }
      } catch {
      }
    }

    let result: PrescriptionAnalysisResult | null = null;
    try {
      result = await analyzeWithOpenRouterFallback(input, inventory);
    } catch {
      result = null;
    }

    if (!result) {
      result = buildDemoAnalysis(input, inventory);
    }

    if (supabase) {
      const { data: insertedOrder } = await supabase
        .from("orders")
        .insert({
          order_code: result.order_code,
          patient_name: result.patient_name,
          patient_phone: result.patient_phone,
          allergies: result.allergies,
          raw_prescription:
            input.prescriptionText || "Загружено изображение рецепта",
          status: result.status,
          requires_pharmacist_approval: result.requires_pharmacist_approval,
          total_kzt: result.total_kzt,
          medications: result.medications,
          safety_warnings: result.safety_warnings,
          patient_instructions: result.patient_instructions,
        })
        .select("id")
        .single();

      if (insertedOrder?.id) {
        result.order_id = insertedOrder.id;
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Не удалось обработать рецепт. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
