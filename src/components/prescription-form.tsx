"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { PrescriptionAnalysisResult } from "@/lib/schemas";
import { PRESCRIPTION_PRESETS, type PrescriptionPreset } from "@/lib/mock-data";

interface PrescriptionFormProps {
  onAnalyzed: (result: PrescriptionAnalysisResult) => void;
}

const ORDER_STATUS_META: Record<
  PrescriptionAnalysisResult["status"],
  { label: string; dotClass: string; badgeClass: string }
> = {
  pending_approval: {
    label: "Ожидает подтверждения фармацевта",
    dotClass: "bg-amber-600",
    badgeClass: "border-amber-300/80 bg-[#fffaeb] text-[#9a5b13]",
  },
  approved: {
    label: "Одобрено фармацевтом",
    dotClass: "bg-emerald-700",
    badgeClass: "border-emerald-300/80 bg-[#ecfdf3] text-[#166534]",
  },
  rejected: {
    label: "Отклонено фармацевтом",
    dotClass: "bg-rose-700",
    badgeClass: "border-rose-300/80 bg-[#fef3f2] text-[#b42318]",
  },
  ready_for_pickup: {
    label: "Готово к выдаче",
    dotClass: "bg-[#114b46]",
    badgeClass: "border-[#114b46]/25 bg-[#e7f1ef] text-[#114b46]",
  },
};

const SOURCE_LABELS: Record<PrescriptionAnalysisResult["source"], string> = {
  n8n: "n8n · OpenRouter",
  openrouter_fallback: "OpenRouter (резерв)",
  demo: "Локальный режим",
};

const SEVERITY_META = {
  high: {
    label: "Критичный риск",
    wrapper: "border-l-4 border-l-[#b42318] border-[#f2c6c2] bg-[#fef3f2] text-[#7a1b14]",
    tag: "bg-[#b42318] text-white",
  },
  medium: {
    label: "Внимание",
    wrapper: "border-l-4 border-l-[#b56a12] border-[#f0d8a8] bg-[#fffaeb] text-[#6d400c]",
    tag: "bg-[#b56a12] text-white",
  },
  low: {
    label: "Рекомендация",
    wrapper: "border-l-4 border-l-[#114b46] border-[#c5ddd9] bg-[#eef6f5] text-[#103c38]",
    tag: "bg-[#114b46] text-white",
  },
};

export function PrescriptionForm({ onAnalyzed }: PrescriptionFormProps) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
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

  function applyPreset(preset: PrescriptionPreset) {
    setPatientName(preset.patientName);
    setPatientPhone(preset.patientPhone);
    setAllergies(preset.allergies);
    setPrescriptionText(preset.prescriptionText);
    setActivePresetId(preset.id);
    setInvalidFields({});
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
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 lg:col-span-5">
        <div className="border-b border-[var(--border-hairline)] pb-4">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent)]">
            Шаг 01 · Ввод назначения
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">
            Загрузка рецепта пациента
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            ИИ сверит препараты со складом, подберёт аналоги и проверит
            противопоказания.
          </p>

          <div className="mt-4">
            <span className="mb-2 block text-xs font-medium text-[var(--ink-muted)]">
              Быстрый тестовый сценарий:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESCRIPTION_PRESETS.map((preset) => {
                const isSelected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label
                htmlFor="patientName"
                className="block text-sm font-medium text-[var(--ink-primary)]"
              >
                ФИО пациента
              </label>
              <span
                id="patientName-hint"
                className="mb-1.5 block text-xs text-[var(--ink-muted)]"
              >
                Имя для карточки заказа
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
                placeholder="Айсана Батырова"
                className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#114b46]/15"
              />
              <div id="patientName-error" className="field-error-msg">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Введите минимум 2 символа.</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="patientPhone"
                className="block text-sm font-medium text-[var(--ink-primary)]"
              >
                Телефон
              </label>
              <span
                id="patientPhone-hint"
                className="mb-1.5 block text-xs text-[var(--ink-muted)]"
              >
                Формат: +7 707 000 00 00
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
                className="field-input tabular-num w-full rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#114b46]/15"
              />
              <div id="patientPhone-error" className="field-error-msg">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Укажите корректный номер.</span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="allergies"
              className="block text-sm font-medium text-[var(--ink-primary)]"
            >
              Аллергии и противопоказания
            </label>
            <span
              id="allergies-hint"
              className="mb-1.5 block text-xs text-[var(--ink-muted)]"
            >
              Укажите вещества для автоматической проверки конфликтов (например:
              пенициллин, аспирин)
            </span>
            <input
              id="allergies"
              name="allergies"
              type="text"
              value={allergies}
              onChange={(event) => setAllergies(event.target.value)}
              aria-describedby="allergies-hint"
              placeholder="Нет или перечислите через запятую"
              className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#114b46]/15"
            />
          </div>

          <div>
            <label
              htmlFor="prescriptionText"
              className="block text-sm font-medium text-[var(--ink-primary)]"
            >
              Текст назначения / рецепта
            </label>
            <span
              id="prescriptionText-hint"
              className="mb-1.5 block text-xs text-[var(--ink-muted)]"
            >
              Препараты, дозировка и режим приёма (можно дополнить фото ниже)
            </span>
            <textarea
              id="prescriptionText"
              name="prescriptionText"
              rows={4}
              value={prescriptionText}
              onChange={(event) => setPrescriptionText(event.target.value)}
              aria-describedby="prescriptionText-hint"
              placeholder="Rp: Амоксициллин 500 мг по 1 капсуле 2 раза в день 7 дней..."
              className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2.5 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#114b46]/15"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink-primary)]">
              Фотография бланка рецепта
            </span>
            {!imageDataUrl ? (
              <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-canvas)] px-4 py-3 text-sm text-[var(--ink-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50">
                <span className="inline-flex items-center gap-2.5 font-medium text-[var(--ink-primary)]">
                  <ImagePlus
                    className="h-4 w-4 text-[var(--accent)]"
                    aria-hidden="true"
                  />
                  Прикрепить фото (JPG / PNG до 4 МБ)
                </span>
                <span className="font-mono text-xs text-[var(--ink-muted)]">
                  Vision AI
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            ) : (
              <div className="fade-enter overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/5">
                  <Image
                    src={imageDataUrl}
                    alt="Превью загруженного бланка рецепта"
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-3.5 py-2.5 text-xs">
                  <span className="min-w-0 truncate font-medium text-[var(--ink-primary)]">
                    {imageFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setImageFileName(null);
                    }}
                    aria-label="Удалить прикреплённое фото рецепта"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="fade-enter flex items-start gap-2.5 rounded-xl border border-[#f2c6c2] bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-[var(--danger)]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ИИ разбирает рецепт и сверяет склад...
              </>
            ) : (
              <>
                <span>Проверить рецепт и оформить заказ</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 lg:col-span-7">
        {!result ? (
          <div className="flex min-h-80 flex-col justify-between gap-6 py-4">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                Шаг 02 · Клиническая верификация
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">
                Лист проверки рецепта
              </h2>
              <p className="mt-1 max-w-lg text-sm text-[var(--ink-secondary)]">
                Выберите один из готовых сценариев слева или введите собственный
                рецепт. Здесь появится полный разбор назначений и решение по
                отпуску.
              </p>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                  01
                </span>
                <div className="mt-1.5 text-sm font-semibold text-[var(--ink-primary)]">
                  Извлечение JSON
                </div>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Распознавание текста и фото рецепта в дозировки, курс и режим
                  приёма.
                </p>
              </li>
              <li className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                  02
                </span>
                <div className="mt-1.5 text-sm font-semibold text-[var(--ink-primary)]">
                  Склад и аналоги
                </div>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Проверка остатков по базе аптеки и подбор дженериков в наличии.
                </p>
              </li>
              <li className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                  03
                </span>
                <div className="mt-1.5 text-sm font-semibold text-[var(--ink-primary)]">
                  Контроль фармацевта
                </div>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Рецептурные и конфликтные заказы уходят в Telegram на одобрение.
                </p>
              </li>
            </ol>
          </div>
        ) : (
          <div key={result.order_id} className="fade-enter space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-base font-semibold tracking-tight text-[var(--ink-primary)]">
                    {result.order_code}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_META[result.status].badgeClass}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${ORDER_STATUS_META[result.status].dotClass}`}
                      aria-hidden="true"
                    />
                    {ORDER_STATUS_META[result.status].label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--ink-secondary)]">
                  {result.patient_name} · Аллергии: {result.allergies} ·{" "}
                  <span className="font-mono">{SOURCE_LABELS[result.source]}</span>
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-right">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  К оплате (в наличии)
                </div>
                <div className="font-mono tabular-num text-lg font-semibold text-[var(--ink-primary)]">
                  {result.total_kzt.toLocaleString("ru-RU")} ₸
                </div>
              </div>
            </div>

            {result.safety_warnings.length > 0 ? (
              <div className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-secondary)]">
                  <ShieldAlert
                    className="h-4 w-4 text-[var(--danger)]"
                    aria-hidden="true"
                  />
                  Контроль безопасности ({result.safety_warnings.length})
                </h3>
                {result.safety_warnings.map((warning, index) => {
                  const meta = SEVERITY_META[warning.severity];
                  return (
                    <div
                      key={`${warning.title}-${index}`}
                      className={`rounded-xl border p-3.5 ${meta.wrapper}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${meta.tag}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-sm font-semibold">
                          {warning.title}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed opacity-95">
                        {warning.details}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#b7e4c7] bg-[var(--success-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--success)]">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Конфликтов с аллергиями и критичных взаимодействий не
                  выявлено.
                </span>
              </div>
            )}

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-secondary)]">
                Назначенные препараты ({result.medications.length})
              </h3>
              <ul className="divide-y divide-[var(--border-hairline)] overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/55">
                {result.medications.map((med, index) => (
                  <li key={`${med.prescribed_name}-${index}`} className="p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--ink-primary)]">
                            {med.prescribed_name}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                              med.requires_prescription
                                ? "bg-[#fde8e6] text-[#b42318]"
                                : "bg-[var(--bg-subtle)] text-[var(--ink-secondary)]"
                            }`}
                          >
                            {med.requires_prescription ? "Rx" : "OTC"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                          {med.dosage} · {med.schedule} · {med.duration}
                        </p>
                      </div>

                      <div className="text-right">
                        {med.in_stock ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              В наличии
                            </span>
                            {med.price_kzt !== null && (
                              <div className="font-mono tabular-num text-sm font-semibold text-[var(--ink-primary)]">
                                {med.price_kzt.toLocaleString("ru-RU")} ₸
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--warning)]">
                            <AlertTriangle
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Нет на складе
                          </span>
                        )}
                      </div>
                    </div>

                    {med.alternative_suggestion && (
                      <div className="mt-2.5 rounded-lg border border-[#c5ddd9] bg-[#eef6f5] px-3 py-2 text-xs text-[#103c38]">
                        <span className="font-semibold">Рекомендация:</span>{" "}
                        {med.alternative_suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                Памятка пациенту
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-primary)]">
                {result.patient_instructions}
              </p>
            </div>

            <p className="border-t border-[var(--border-hairline)] pt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
              {result.disclaimer}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
