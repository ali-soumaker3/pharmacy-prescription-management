"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  OrderStatus,
  PharmacyOrderRecord,
  PrescriptionAnalysisResult,
} from "@/lib/schemas";
import { PRESCRIPTION_PRESETS, type PrescriptionPreset } from "@/lib/mock-data";

interface PrescriptionFormProps {
  orders: PharmacyOrderRecord[];
  onAnalyzed: (result: PrescriptionAnalysisResult) => void;
  onOpenPharmacistPanel: () => void;
}

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  pending_approval: {
    label: "На проверке",
    dotClass: "bg-[var(--warning)]",
    badgeClass:
      "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
  },
  approved: {
    label: "Одобрено",
    dotClass: "bg-[var(--success)]",
    badgeClass:
      "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
  },
  rejected: {
    label: "Отклонено",
    dotClass: "bg-[var(--danger)]",
    badgeClass:
      "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
  },
  ready_for_pickup: {
    label: "Готово к выдаче",
    dotClass: "bg-[var(--accent)]",
    badgeClass:
      "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  },
};

const SEVERITY_META = {
  high: {
    label: "Высокий риск",
    wrapper:
      "border-l-4 border-l-[var(--danger)] border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--ink-primary)]",
    tag: "bg-[var(--danger)] text-white",
  },
  medium: {
    label: "Внимание",
    wrapper:
      "border-l-4 border-l-[var(--warning)] border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--ink-primary)]",
    tag: "bg-[var(--warning)] text-white",
  },
  low: {
    label: "Примечание",
    wrapper:
      "border-l-4 border-l-[var(--accent)] border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--ink-primary)]",
    tag: "bg-[var(--accent)] text-[var(--accent-ink)]",
  },
};

const ANALYSIS_STEPS = [
  "Разбор текста и дозировок",
  "Проверка наличия на складе",
  "Проверка противопоказаний",
  "Оформление заказа",
];

const AUTO_TELEGRAM_NOTES = new Set([
  "Одобрено фармацевтом в Telegram",
  "Отклонено фармацевтом в Telegram",
]);

export function PrescriptionForm({
  orders,
  onAnalyzed,
  onOpenPharmacistPanel,
}: PrescriptionFormProps) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionAnalysisResult | null>(null);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!submitting) {
      setAnalysisStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 2400);

    return () => window.clearInterval(timer);
  }, [submitting]);

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
      setErrorMessage("Размер файла не должен превышать 4 МБ.");
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

  function handleResetForm() {
    setPatientName("");
    setPatientPhone("");
    setAllergies("");
    setPrescriptionText("");
    setImageDataUrl(null);
    setImageFileName(null);
    setActivePresetId(null);
    setResult(null);
    setErrorMessage(null);
    setInvalidFields({});
    setCopiedCode(false);
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!prescriptionText.trim() && !imageDataUrl) {
      setErrorMessage("Введите текст рецепта или прикрепите фото.");
      return;
    }

    setSubmitting(true);
    setAnalysisStep(0);
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
      setErrorMessage("Сетевая ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  const liveOrder = result
    ? orders.find(
        (item) =>
          item.id === result.order_id || item.order_code === result.order_code,
      )
    : undefined;
  const displayStatus: OrderStatus | null = result
    ? (liveOrder?.status ?? result.status)
    : null;
  const rawNote = liveOrder?.pharmacist_note ?? null;
  const customNote =
    rawNote && !AUTO_TELEGRAM_NOTES.has(rawNote) ? rawNote : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 lg:col-span-5">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-4">
          <h2 className="text-base font-semibold text-[var(--ink-primary)]">
            Новый рецепт
          </h2>
          {(patientName || prescriptionText || result) && (
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--ink-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Очистить
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-[var(--ink-muted)]">Примеры:</span>
          {PRESCRIPTION_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label
                htmlFor="patientName"
                className="mb-1.5 block text-sm font-medium text-[var(--ink-primary)]"
              >
                Пациент
              </label>
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
                  invalidFields.patientName ? "patientName-error" : undefined
                }
                placeholder="Айсана Батырова"
                className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
              <div id="patientName-error" className="field-error-msg">
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Минимум 2 символа.</span>
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
                className="mb-1 block font-mono text-[11px] text-[var(--ink-muted)]"
              >
                +7 707 000 00 00
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
                className="field-input tabular-num w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
              <div id="patientPhone-error" className="field-error-msg">
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Некорректный номер.</span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="allergies"
              className="mb-1.5 block text-sm font-medium text-[var(--ink-primary)]"
            >
              Аллергии
            </label>
            <input
              id="allergies"
              name="allergies"
              type="text"
              value={allergies}
              onChange={(event) => setAllergies(event.target.value)}
              placeholder="Нет или через запятую"
              className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>

          <div>
            <label
              htmlFor="prescriptionText"
              className="mb-1.5 block text-sm font-medium text-[var(--ink-primary)]"
            >
              Назначение
            </label>
            <textarea
              id="prescriptionText"
              name="prescriptionText"
              rows={4}
              value={prescriptionText}
              onChange={(event) => setPrescriptionText(event.target.value)}
              placeholder="Rp: Амоксициллин 500 мг — 1 капс. 2 раза в день..."
              className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[var(--ink-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>

          <div>
            {!imageDataUrl ? (
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-canvas)]/70 px-4 py-2.5 text-sm text-[var(--ink-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50">
                <span className="inline-flex items-center gap-2 font-medium text-[var(--ink-primary)]">
                  <ImagePlus
                    className="h-4 w-4 text-[var(--accent)]"
                    aria-hidden="true"
                  />
                  Прикрепить фото бланка
                </span>
                <span className="font-mono text-xs text-[var(--ink-muted)]">
                  до 4 МБ
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
                    alt="Превью бланка рецепта"
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-3.5 py-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-[var(--ink-primary)]">
                    {imageFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setImageFileName(null);
                    }}
                    aria-label="Удалить фото рецепта"
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
              className="fade-enter flex items-start gap-2.5 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-[var(--danger)]"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Проверка рецепта...
              </>
            ) : (
              <>
                <span>Проверить рецепт</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 lg:col-span-7">
        {submitting ? (
          <div
            role="status"
            aria-live="polite"
            className="fade-enter space-y-4 py-2"
          >
            <h2 className="text-base font-semibold text-[var(--ink-primary)]">
              Обработка рецепта
            </h2>

            <ol className="space-y-2">
              {ANALYSIS_STEPS.map((label, index) => {
                const isDone = index < analysisStep;
                const isCurrent = index === analysisStep;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${
                      isCurrent
                        ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--ink-primary)]"
                        : isDone
                          ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--ink-primary)]"
                          : "border-[var(--border-hairline)] bg-[var(--bg-canvas)]/50 text-[var(--ink-muted)]"
                    }`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {isDone ? (
                        <Check
                          className="h-4 w-4 text-[var(--success)]"
                          aria-hidden="true"
                        />
                      ) : isCurrent ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-[var(--accent)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="font-mono text-xs">
                          0{index + 1}
                        </span>
                      )}
                    </div>
                    <span className="font-medium">{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : !result || !displayStatus ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-muted)]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-[var(--ink-primary)]">
              Лист проверки
            </h2>
            <p className="mt-1 max-w-xs text-sm text-[var(--ink-muted)]">
              Заполните форму слева и отправьте рецепт.
            </p>
          </div>
        ) : (
          <div key={result.order_id} className="fade-enter space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCode(result.order_code)}
                    title="Скопировать номер"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-sm font-semibold text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
                  >
                    <span>{result.order_code}</span>
                    {copiedCode ? (
                      <Check
                        className="h-3.5 w-3.5 text-[var(--success)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy
                        className="h-3.5 w-3.5 text-[var(--ink-muted)]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${ORDER_STATUS_META[displayStatus].badgeClass}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${ORDER_STATUS_META[displayStatus].dotClass}`}
                      aria-hidden="true"
                    />
                    {ORDER_STATUS_META[displayStatus].label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--ink-secondary)]">
                  {result.patient_name} · Аллергии: {result.allergies}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-right">
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
                  Итого
                </div>
                <div className="font-mono tabular-num text-lg font-semibold text-[var(--ink-primary)]">
                  {result.total_kzt.toLocaleString("ru-RU")} ₸
                </div>
              </div>
            </div>

            {displayStatus === "pending_approval" && (
              <div className="fade-enter flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3.5 py-2.5 text-xs text-[var(--warning)]">
                <span>Ожидает подтверждения фармацевта</span>
                <button
                  type="button"
                  onClick={onOpenPharmacistPanel}
                  className="inline-flex shrink-0 items-center gap-1 font-semibold underline decoration-current/40 underline-offset-4 hover:decoration-current"
                >
                  Открыть в заказах
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {customNote && displayStatus !== "pending_approval" && (
              <div className="fade-enter rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs text-[var(--ink-secondary)]">
                <strong className="text-[var(--ink-primary)]">
                  Комментарий фармацевта:
                </strong>{" "}
                {customNote}
              </div>
            )}

            {result.safety_warnings.length > 0 ? (
              <div className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                  <ShieldAlert
                    className="h-4 w-4 text-[var(--danger)]"
                    aria-hidden="true"
                  />
                  Предупреждения ({result.safety_warnings.length})
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
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                        {warning.details}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--success)]">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Противопоказаний не выявлено.</span>
              </div>
            )}

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                Препараты ({result.medications.length})
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
                                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
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
                      <div className="mt-2.5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--ink-primary)]">
                        <span className="font-semibold text-[var(--accent)]">
                          Аналог:
                        </span>{" "}
                        {med.alternative_suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                Памятка
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-primary)]">
                {result.patient_instructions}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-3">
              <p className="max-w-lg text-xs text-[var(--ink-muted)]">
                Справочная проверка. Не заменяет консультацию врача.
              </p>
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Новый рецепт
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
