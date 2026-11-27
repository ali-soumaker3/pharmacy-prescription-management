import { z } from "zod";
import {
  ParsedMedicationSchema,
  SafetyWarningSchema,
  type AnalyzePrescriptionRequest,
  type MedicationInventoryItem,
  type PrescriptionAnalysisResult,
} from "@/lib/schemas";
import { MEDICAL_DISCLAIMER_RU } from "@/lib/mock-data";
import { buildOrderCode } from "@/lib/demo-analyzer";

const OpenRouterModelPayloadSchema = z.object({
  medications: z.array(ParsedMedicationSchema).default([]),
  safety_warnings: z.array(SafetyWarningSchema).default([]),
  patient_instructions: z.string().default(""),
  requires_pharmacist_approval: z.boolean().default(true),
});

const SYSTEM_PROMPT_RU = [
  "Ты фармацевтический ИИ-ассистент аптеки. Отвечай строго валидным JSON-объектом на русском языке без markdown и пояснений.",
  "Схема JSON:",
  "{",
  '  "medications": [',
  "    {",
  '      "prescribed_name": "string",',
  '      "dosage": "string",',
  '      "schedule": "string",',
  '      "duration": "string",',
  '      "requires_prescription": true,',
  '      "in_stock": true,',
  '      "matched_medication_id": "string | null",',
  '      "matched_medication_name": "string | null",',
  '      "price_kzt": 1850,',
  '      "alternative_suggestion": "string | null"',
  "    }",
  "  ],",
  '  "safety_warnings": [',
  '    { "severity": "low | medium | high", "title": "string", "details": "string" }',
  "  ],",
  '  "patient_instructions": "string",',
  '  "requires_pharmacist_approval": true',
  "}",
  "Обязательные правила безопасности:",
  "1. Проверяй наличие (in_stock), matched_medication_id и price_kzt СТРОГО по переданному массиву inventory. Не выдумывай товары и цены.",
  "2. Если препарата нет в наличии (stock_qty = 0), поставь in_stock: false, matched_medication_id: null, price_kzt: null и предложи аналог в alternative_suggestion из inventory с тем же active_ingredient и stock_qty > 0.",
  "3. Если препарат из рецепта отсутствует в inventory, поставь in_stock: false, matched_medication_id: null, price_kzt: null.",
  "4. Если у пациента есть аллергия из поля allergies, конфликтующая с препаратом (например, пенициллин + амоксициллин/аугментин), обязательно добавь предупреждение severity: high.",
  "5. Ставь requires_pharmacist_approval: true, если хотя бы один препарат рецептурный или есть предупреждение severity: high.",
].join("\n");

function extractJsonObject(rawContent: string): string {
  const trimmed = rawContent.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export async function analyzeWithOpenRouterFallback(
  input: AnalyzePrescriptionRequest,
  inventory: MedicationInventoryItem[],
): Promise<PrescriptionAnalysisResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const textPrompt = [
    `Пациент: ${input.patientName}`,
    `Аллергии: ${input.allergies || "Не указаны"}`,
    `Текст рецепта: ${input.prescriptionText || "Распознай препараты с приложенного фото рецепта."}`,
    `Склад аптеки (JSON): ${JSON.stringify(inventory)}`,
  ].join("\n");

  const userContent = input.imageDataUrl
    ? [
        { type: "text", text: textPrompt },
        { type: "image_url", image_url: { url: input.imageDataUrl } },
      ]
    : textPrompt;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pharmacy-prescription-management.vercel.app",
      "X-Title": "Pharmacy Prescription Management",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT_RU },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(40000),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return null;
  }

  const rawJson = JSON.parse(extractJsonObject(content));
  const parsed = OpenRouterModelPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    return null;
  }

  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const verifiedMedications = parsed.data.medications.map((med) => {
    const matchedItem = med.matched_medication_id
      ? inventoryById.get(med.matched_medication_id)
      : undefined;

    if (matchedItem && matchedItem.stock_qty > 0) {
      return {
        ...med,
        in_stock: true,
        matched_medication_id: matchedItem.id,
        matched_medication_name: matchedItem.name,
        price_kzt: matchedItem.price_kzt,
        requires_prescription:
          med.requires_prescription || matchedItem.requires_prescription,
      };
    }

    return {
      ...med,
      in_stock: false,
      matched_medication_id: null,
      matched_medication_name: null,
      price_kzt: null,
    };
  });

  const requiresPharmacistApproval =
    parsed.data.requires_pharmacist_approval ||
    verifiedMedications.some((med) => med.requires_prescription) ||
    parsed.data.safety_warnings.some((warning) => warning.severity === "high");

  const totalKzt = verifiedMedications.reduce(
    (sum, med) => sum + (med.in_stock && med.price_kzt ? med.price_kzt : 0),
    0,
  );

  return {
    order_id: crypto.randomUUID(),
    order_code: buildOrderCode(),
    status: requiresPharmacistApproval ? "pending_approval" : "ready_for_pickup",
    source: "openrouter_fallback",
    patient_name: input.patientName,
    patient_phone: input.patientPhone,
    allergies: input.allergies || "Не указаны",
    medications: verifiedMedications,
    safety_warnings: parsed.data.safety_warnings,
    patient_instructions:
      parsed.data.patient_instructions ||
      "Соблюдайте назначенную врачом схему приёма.",
    total_kzt: totalKzt,
    requires_pharmacist_approval: requiresPharmacistApproval,
    disclaimer: MEDICAL_DISCLAIMER_RU,
    created_at: new Date().toISOString(),
  };
}
