import type {
  AnalyzePrescriptionRequest,
  MedicationInventoryItem,
  ParsedMedication,
  PrescriptionAnalysisResult,
  SafetyWarning,
} from "@/lib/schemas";
import { MEDICAL_DISCLAIMER_RU } from "@/lib/mock-data";

export function buildOrderCode(): string {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `RX-${randomPart}`;
}

export function buildDemoAnalysis(
  input: AnalyzePrescriptionRequest,
  inventory: MedicationInventoryItem[],
): PrescriptionAnalysisResult {
  const text = input.prescriptionText.toLowerCase();
  const allergiesLower = input.allergies.toLowerCase();
  const matched: ParsedMedication[] = [];
  const warnings: SafetyWarning[] = [];

  for (const item of inventory) {
    const baseName = item.name.split(" ")[0].toLowerCase();
    const ingredient = item.active_ingredient.split(" ")[0].toLowerCase();
    if (text.includes(baseName) || text.includes(ingredient)) {
      const inStock = item.stock_qty > 0;
      let alternative: string | null = null;
      if (!inStock) {
        const sameIngredient = inventory.find(
          (candidate) =>
            candidate.id !== item.id &&
            candidate.stock_qty > 0 &&
            candidate.active_ingredient.toLowerCase() ===
              item.active_ingredient.toLowerCase(),
        );
        alternative = sameIngredient
          ? `${sameIngredient.name} (${sameIngredient.price_kzt} ₸)`
          : null;
      }

      matched.push({
        prescribed_name: item.name,
        dosage: item.dosage,
        schedule: item.requires_prescription
          ? "По схеме врача, 2 раза в день"
          : "По назначению, до 3 раз в день",
        duration: item.requires_prescription ? "7 дней" : "По симптомам",
        requires_prescription: item.requires_prescription,
        in_stock: inStock,
        matched_medication_id: inStock ? item.id : null,
        matched_medication_name: inStock ? item.name : null,
        price_kzt: inStock ? item.price_kzt : null,
        alternative_suggestion: alternative,
      });
    }
  }

  if (matched.length === 0) {
    const fallbackItem = inventory[0];
    matched.push({
      prescribed_name:
        input.prescriptionText.slice(0, 60) || "Препарат с фото рецепта",
      dosage: "Уточнить у фармацевта",
      schedule: "Согласно бланку рецепта",
      duration: "По назначению врача",
      requires_prescription: true,
      in_stock: Boolean(fallbackItem && fallbackItem.stock_qty > 0),
      matched_medication_id: null,
      matched_medication_name: null,
      price_kzt: null,
      alternative_suggestion:
        "Требуется ручная проверка фармацевтом (демо-режим без подключенного n8n)",
    });
  }

  if (
    allergiesLower.includes("пенициллин") &&
    matched.some((med) =>
      med.prescribed_name.toLowerCase().includes("амоксициллин"),
    )
  ) {
    warnings.push({
      severity: "high",
      title: "Риск аллергии на пенициллины",
      details:
        "У пациента указана аллергия на пенициллин, при этом в рецепте присутствует амоксициллин. Требуется обязательная замена врачом (например, макролиды).",
    });
  }

  if (
    matched.some((med) =>
      med.prescribed_name.toLowerCase().includes("ибупрофен"),
    ) ||
    matched.some((med) => med.prescribed_name.toLowerCase().includes("нурофен"))
  ) {
    warnings.push({
      severity: "medium",
      title: "Приём НПВС после еды",
      details:
        "Ибупрофен рекомендуется принимать после еды для снижения риска раздражения слизистой желудка.",
    });
  }

  const requiresPharmacistApproval =
    matched.some((med) => med.requires_prescription) ||
    warnings.some((warning) => warning.severity === "high");

  const totalKzt = matched.reduce((sum, med) => sum + (med.price_kzt ?? 0), 0);

  return {
    order_id: crypto.randomUUID(),
    order_code: buildOrderCode(),
    status: requiresPharmacistApproval ? "pending_approval" : "ready_for_pickup",
    source: "demo",
    patient_name: input.patientName,
    patient_phone: input.patientPhone,
    allergies: input.allergies || "Не указаны",
    medications: matched,
    safety_warnings: warnings,
    patient_instructions:
      "Соблюдайте назначенную врачом дозировку и интервал приёма. При появлении сыпи или ухудшении самочувствия немедленно обратитесь к врачу.",
    total_kzt: totalKzt,
    requires_pharmacist_approval: requiresPharmacistApproval,
    disclaimer: MEDICAL_DISCLAIMER_RU,
    created_at: new Date().toISOString(),
  };
}
