import { z } from "zod";

export const OrderStatusSchema = z.enum([
  "pending_approval",
  "approved",
  "rejected",
  "ready_for_pickup",
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const SafetySeveritySchema = z.enum(["low", "medium", "high"]);

export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;

export const MedicationInventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  active_ingredient: z.string(),
  dosage: z.string(),
  price_kzt: z.number().int().nonnegative(),
  stock_qty: z.number().int().nonnegative(),
  requires_prescription: z.boolean(),
});

export type MedicationInventoryItem = z.infer<
  typeof MedicationInventoryItemSchema
>;

export const ParsedMedicationSchema = z.object({
  prescribed_name: z.string(),
  dosage: z.string(),
  schedule: z.string(),
  duration: z.string(),
  requires_prescription: z.boolean(),
  in_stock: z.boolean(),
  matched_medication_id: z.string().nullable(),
  matched_medication_name: z.string().nullable(),
  price_kzt: z.number().int().nonnegative().nullable(),
  alternative_suggestion: z.string().nullable(),
});

export type ParsedMedication = z.infer<typeof ParsedMedicationSchema>;

export const SafetyWarningSchema = z.object({
  severity: SafetySeveritySchema,
  title: z.string(),
  details: z.string(),
});

export type SafetyWarning = z.infer<typeof SafetyWarningSchema>;

export const PrescriptionAnalysisResultSchema = z.object({
  order_id: z.string(),
  order_code: z.string(),
  status: OrderStatusSchema,
  source: z.enum(["n8n", "openrouter_fallback", "demo"]),
  patient_name: z.string(),
  patient_phone: z.string(),
  allergies: z.string(),
  medications: z.array(ParsedMedicationSchema),
  safety_warnings: z.array(SafetyWarningSchema),
  patient_instructions: z.string(),
  total_kzt: z.number().int().nonnegative(),
  requires_pharmacist_approval: z.boolean(),
  disclaimer: z.string(),
  created_at: z.string(),
});

export type PrescriptionAnalysisResult = z.infer<
  typeof PrescriptionAnalysisResultSchema
>;

export const AnalyzePrescriptionRequestSchema = z.object({
  patientName: z.string().trim().min(2, "Укажите имя пациента"),
  patientPhone: z.string().trim().min(6, "Укажите контактный телефон"),
  allergies: z.string().trim().default(""),
  prescriptionText: z.string().trim().default(""),
  imageDataUrl: z.string().nullable().default(null),
});

export type AnalyzePrescriptionRequest = z.infer<
  typeof AnalyzePrescriptionRequestSchema
>;

export const PharmacyOrderRecordSchema = z.object({
  id: z.string(),
  order_code: z.string(),
  patient_name: z.string(),
  patient_phone: z.string(),
  allergies: z.string(),
  raw_prescription: z.string(),
  status: OrderStatusSchema,
  requires_pharmacist_approval: z.boolean(),
  total_kzt: z.number().int().nonnegative(),
  medications: z.array(ParsedMedicationSchema),
  safety_warnings: z.array(SafetyWarningSchema),
  patient_instructions: z.string(),
  pharmacist_note: z.string().nullable(),
  created_at: z.string(),
});

export type PharmacyOrderRecord = z.infer<typeof PharmacyOrderRecordSchema>;

export const PharmacistDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  pharmacistNote: z.string().trim().max(500).default(""),
});

export type PharmacistDecision = z.infer<typeof PharmacistDecisionSchema>;
