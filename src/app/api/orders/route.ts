import { NextResponse } from "next/server";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { DEMO_INVENTORY, DEMO_ORDERS } from "@/lib/mock-data";

export async function GET() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "demo",
      supabaseConnected: false,
      n8nConfigured: Boolean(process.env.N8N_ANALYZE_WEBHOOK_URL),
      orders: DEMO_ORDERS,
      inventory: DEMO_INVENTORY,
    });
  }

  const [ordersResult, inventoryResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_code, patient_name, patient_phone, allergies, raw_prescription, status, requires_pharmacist_approval, total_kzt, medications, safety_warnings, patient_instructions, pharmacist_note, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("medications")
      .select(
        "id, name, active_ingredient, dosage, price_kzt, stock_qty, requires_prescription",
      )
      .order("name"),
  ]);

  if (ordersResult.error || inventoryResult.error) {
    return NextResponse.json({
      mode: "demo",
      supabaseConnected: isSupabaseConfigured(),
      n8nConfigured: Boolean(process.env.N8N_ANALYZE_WEBHOOK_URL),
      warning:
        "Подключение к Supabase настроено, но таблицы ещё не созданы. Выполните supabase/schema.sql в SQL Editor.",
      orders: DEMO_ORDERS,
      inventory: DEMO_INVENTORY,
    });
  }

  return NextResponse.json({
    mode: "live",
    supabaseConnected: true,
    n8nConfigured: Boolean(process.env.N8N_ANALYZE_WEBHOOK_URL),
    orders: ordersResult.data ?? [],
    inventory: inventoryResult.data ?? [],
  });
}
