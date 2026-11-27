"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Pill,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { PrescriptionAnalysisResult } from "@/lib/schemas";
import { SAMPLE_PRESCRIPTION_TEXT } from "@/lib/mock-data";

interface PrescriptionFormProps {
  onAnalyzed: (result: PrescriptionAnalysisResult) => void;
}

const ORDER_STATUS_LABELS: Record<
  PrescriptionAnalysisResult["status"],
  { label: string; badgeClass: string }
> = {
  pending_approval: {
    label: "Ожидает подтверждения фармацевта",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  approved: {
    label: "Одобрено фармацевтом",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  rejected: {
    label: "Отклонено фармацевтом",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
  },
  ready_for_pickup: {
    label: "Готово к выдаче",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-200",
  },
};

const SOURCE_LABELS: Record<PrescriptionAnalysisResult["source"], string> = {
  n8n: "n8n + OpenRouter",
  openrouter_fallback: "OpenRouter (резерв)",
  demo: "Локальный демо-режим",
};

const SEVERITY_STYLES = {
  high: "border-rose-300 bg-rose-50 text-rose-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-sky-300 bg-sky-50 text-sky-900",
};

export function PrescriptionForm({ onAnalyzed }: PrescriptionFormProps) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionAnalysisResult | null>(null);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>(
    {},
  );

  function syncFieldValidity(target: HTMLInputElement | HTMLTextAreaElement) {
    const isInvalid = target.matches(":user-invalid");
    setInvalidFields((prev) =>
      prev[target.name] === isInvalid
        ? prev
        : { ...prev, [target.name]: isInvalid },
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorMessage("Размер фото рецепта не должен превышать 4 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageDataUrl(reader.result);
        setImageFileName(file.name);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleFillSample() {
    setPatientName("Айсана Батырова");
    setPatientPhone("+7 707 412 88 90");
    setAllergies("Пенициллин");
    setPrescriptionText(SAMPLE_PRESCRIPTION_TEXT);
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!prescriptionText.trim() && !imageDataUrl) {
      setErrorMessage("Введите текст рецепта или загрузите фотографию бланка.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/prescriptions/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientName,
          patientPhone,
          allergies,
          prescriptionText,
          imageDataUrl,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setErrorMessage(payload.error || "Ошибка при проверке рецепта.");
        return;
      }

      setResult(payload);
      onAnalyzed(payload);
    } catch {
      setErrorMessage("Сетевая ошибка при отправке рецепта. Попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Загрузка рецепта
            </h2>
            <p className="text-sm text-slate-500">
              ИИ распознает препараты, проверит склад и взаимодействия.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFillSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Вставить пример
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="patientName"
              className="block text-sm font-medium text-slate-800"
            >
              ФИО пациента
            </label>
            <span
              id="patientName-hint"
              className="mb-1 block text-xs text-slate-500"
            >
              Укажите имя и фамилию для оформления заказа
            </span>
            <input
              id="patientName"
              name="patientName"
              type="text"
              required
              minLength={2}
              autoComplete="name"
              value={patientName}
              onChange={(event) => {
                setPatientName(event.target.value);
                syncFieldValidity(event.currentTarget);
              }}
              onBlur={(event) => syncFieldValidity(event.currentTarget)}
              aria-invalid={invalidFields.patientName ? "true" : "false"}
              aria-describedby={
                invalidFields.patientName
                  ? "patientName-hint patientName-error"
                  : "patientName-hint"
              }
              placeholder="Например: Айсана Батырова"
              className="field-input w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
            <div id="patientName-error" className="field-error-msg">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Ошибка: введите минимум 2 символа для имени пациента.</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="patientPhone"
              className="block text-sm font-medium text-slate-800"
            >
              Телефон пациента
            </label>
            <span
              id="patientPhone-hint"
              className="mb-1 block text-xs text-slate-500"
            >
              Формат: +7 707 000 00 00 (для уведомления о готовности)
            </span>
            <input
              id="patientPhone"
              name="patientPhone"
              type="tel"
              required
              minLength={6}
              autoComplete="tel"
              value={patientPhone}
              onChange={(event) => {
                setPatientPhone(event.target.value);
                syncFieldValidity(event.currentTarget);
              }}
              onBlur={(event) => syncFieldValidity(event.currentTarget)}
              aria-invalid={invalidFields.patientPhone ? "true" : "false"}
              aria-describedby={
                invalidFields.patientPhone
                  ? "patientPhone-hint patientPhone-error"
                  : "patientPhone-hint"
              }
              placeholder="+7 707 412 88 90"
              className="field-input w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
            <div id="patientPhone-error" className="field-error-msg">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Ошибка: укажите корректный номер телефона.</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="allergies"
              className="block text-sm font-medium text-slate-800"
            >
              Аллергии и противопоказания (необязательно)
            </label>
            <span
              id="allergies-hint"
              className="mb-1 block text-xs text-slate-500"
            >
              Например: пенициллин, аспирин, лактоза
            </span>
            <input
              id="allergies"
              name="allergies"
              type="text"
              value={allergies}
              onChange={(event) => setAllergies(event.target.value)}
              aria-describedby="allergies-hint"
              placeholder="Нет или перечислите через запятую"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="prescriptionText"
              className="block text-sm font-medium text-slate-800"
            >
              Текст рецепта
            </label>
            <span
              id="prescriptionText-hint"
              className="mb-1 block text-xs text-slate-500"
            >
              Укажите названия препаратов, дозировки и схему приёма
            </span>
            <textarea
              id="prescriptionText"
              name="prescriptionText"
              rows={4}
              value={prescriptionText}
              onChange={(event) => setPrescriptionText(event.target.value)}
              aria-describedby="prescriptionText-hint"
              placeholder="Rp: Амоксициллин 500 мг по 1 капсуле 2 раза в день..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-800">
              Фотография бланка рецепта (необязательно)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50/50">
                <ImagePlus className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <span>Загрузить фото</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              {imageFileName && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                  <FileText className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                  <span className="max-w-44 truncate">{imageFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setImageFileName(null);
                    }}
                    aria-label="Удалить прикреплённое фото"
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ИИ анализирует рецепт...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Проверить рецепт и оформить заказ
              </>
            )}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
        {!result ? (
          <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <Pill className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Результат ИИ-проверки появится здесь
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Заполните форму слева или нажмите «Вставить пример», чтобы увидеть
              распознанные препараты, наличие на складе, подбор аналогов и
              проверку взаимодействий.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Заказ {result.order_code}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_LABELS[result.status].badgeClass}`}
                  >
                    {ORDER_STATUS_LABELS[result.status].label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Пациент: {result.patient_name} · Аллергии: {result.allergies} ·
                  Источник: {SOURCE_LABELS[result.source]}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Итого по наличию</div>
                <div className="text-xl font-bold text-slate-900">
                  {result.total_kzt.toLocaleString("ru-RU")} ₸
                </div>
              </div>
            </div>

            {result.safety_warnings.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <ShieldAlert className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  Проверка безопасности и взаимодействий
                </h3>
                {result.safety_warnings.map((warning, index) => (
                  <div
                    key={`${warning.title}-${index}`}
                    className={`rounded-lg border p-3 text-sm ${SEVERITY_STYLES[warning.severity]}`}
                  >
                    <div className="font-semibold">{warning.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                      {warning.details}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Распознанные препараты ({result.medications.length})
              </h3>
              <ul className="space-y-2.5">
                {result.medications.map((med, index) => (
                  <li
                    key={`${med.prescribed_name}-${index}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {med.prescribed_name}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              med.requires_prescription
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {med.requires_prescription
                              ? "Рецептурный (Rx)"
                              : "Без рецепта (OTC)"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          Дозировка: {med.dosage} · Схема: {med.schedule} · Курс:{" "}
                          {med.duration}
                        </p>
                      </div>
                      <div className="text-right">
                        {med.in_stock ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              В наличии
                            </span>
                            {med.price_kzt !== null && (
                              <div className="text-sm font-semibold text-slate-900">
                                {med.price_kzt.toLocaleString("ru-RU")} ₸
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            Нет в наличии
                          </span>
                        )}
                      </div>
                    </div>

                    {med.alternative_suggestion && (
                      <div className="mt-2 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs text-teal-900">
                        <strong>Аналог на складе:</strong>{" "}
                        {med.alternative_suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Памятка пациенту
              </div>
              <p className="mt-1 text-sm text-slate-800">
                {result.patient_instructions}
              </p>
            </div>

            <p className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              {result.disclaimer}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
