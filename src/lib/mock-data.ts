import type {
  MedicationInventoryItem,
  PharmacyOrderRecord,
} from "@/lib/schemas";

export const MEDICAL_DISCLAIMER_RU =
  "Информация носит справочный характер и не заменяет консультацию врача. Отпуск рецептурных препаратов выполняется только после проверки и подтверждения фармацевтом.";

export const DEMO_INVENTORY: MedicationInventoryItem[] = [
  {
    id: "med-amox-500",
    name: "Амоксициллин 500 мг",
    active_ingredient: "Амоксициллин",
    dosage: "500 мг, капсулы №20",
    price_kzt: 1850,
    stock_qty: 24,
    requires_prescription: true,
  },
  {
    id: "med-augmentin-875",
    name: "Аугментин 875/125 мг",
    active_ingredient: "Амоксициллин + клавулановая кислота",
    dosage: "875/125 мг, таблетки №14",
    price_kzt: 5200,
    stock_qty: 12,
    requires_prescription: true,
  },
  {
    id: "med-azithro-500",
    name: "Азитромицин 500 мг",
    active_ingredient: "Азитромицин",
    dosage: "500 мг, таблетки №3",
    price_kzt: 1450,
    stock_qty: 18,
    requires_prescription: true,
  },
  {
    id: "med-ibuprofen-400",
    name: "Ибупрофен 400 мг",
    active_ingredient: "Ибупрофен",
    dosage: "400 мг, таблетки №20",
    price_kzt: 980,
    stock_qty: 40,
    requires_prescription: false,
  },
  {
    id: "med-paracetamol-500",
    name: "Парацетамол 500 мг",
    active_ingredient: "Парацетамол",
    dosage: "500 мг, таблетки №20",
    price_kzt: 420,
    stock_qty: 55,
    requires_prescription: false,
  },
  {
    id: "med-omeprazole-20",
    name: "Омепразол 20 мг",
    active_ingredient: "Омепразол",
    dosage: "20 мг, капсулы №28",
    price_kzt: 1150,
    stock_qty: 31,
    requires_prescription: false,
  },
  {
    id: "med-cetirizine-10",
    name: "Цетиризин 10 мг",
    active_ingredient: "Цетиризин",
    dosage: "10 мг, таблетки №10",
    price_kzt: 890,
    stock_qty: 27,
    requires_prescription: false,
  },
  {
    id: "med-nurofen-400",
    name: "Нурофен Форте 400 мг",
    active_ingredient: "Ибупрофен",
    dosage: "400 мг, таблетки №12",
    price_kzt: 2650,
    stock_qty: 0,
    requires_prescription: false,
  },
];

export const DEMO_ORDERS: PharmacyOrderRecord[] = [
  {
    id: "ord-demo-1001",
    order_code: "RX-1001",
    patient_name: "Айгерим Серикова",
    patient_phone: "+7 701 555 01 23",
    allergies: "Нет",
    raw_prescription:
      "Амоксициллин 500 мг по 1 капсуле 2 раза в день 7 дней, Омепразол 20 мг утром до еды",
    status: "pending_approval",
    requires_pharmacist_approval: true,
    total_kzt: 3000,
    medications: [
      {
        prescribed_name: "Амоксициллин 500 мг",
        dosage: "500 мг",
        schedule: "2 раза в день",
        duration: "7 дней",
        requires_prescription: true,
        in_stock: true,
        matched_medication_id: "med-amox-500",
        matched_medication_name: "Амоксициллин 500 мг",
        price_kzt: 1850,
        alternative_suggestion: null,
      },
      {
        prescribed_name: "Омепразол 20 мг",
        dosage: "20 мг",
        schedule: "1 раз в день утром до еды",
        duration: "14 дней",
        requires_prescription: false,
        in_stock: true,
        matched_medication_id: "med-omeprazole-20",
        matched_medication_name: "Омепразол 20 мг",
        price_kzt: 1150,
        alternative_suggestion: null,
      },
    ],
    safety_warnings: [
      {
        severity: "low",
        title: "Контроль курса антибиотика",
        details:
          "Необходимо пройти полный 7-дневный курс амоксициллина даже при улучшении самочувствия.",
      },
    ],
    patient_instructions:
      "Принимайте Омепразол за 30 минут до завтрака. Амоксициллин принимайте каждые 12 часов, запивая стаканом воды.",
    pharmacist_note: null,
    created_at: "2026-11-27T07:15:00.000Z",
  },
];

export const SAMPLE_PRESCRIPTION_TEXT =
  "Rp: Амоксициллин 500 мг — по 1 капсуле 2 раза в день 7 дней.\nНурофен Форте 400 мг — при температуре выше 38.5°C, не более 3 раз в сутки.\nОмепразол 20 мг — 1 капсула утром за 30 минут до еды.";
