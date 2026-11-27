"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { OrderStatus, PharmacyOrderRecord } from "@/lib/schemas";

interface PharmacyDashboardProps {
  orders: PharmacyOrderRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOrderUpdated: (
    orderId: string,
    status: OrderStatus,
    note: string | null,
  ) => void;
}

type StatusFilter = "all" | OrderStatus;

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "pending_approval", label: "На проверке" },
  { id: "approved", label: "Одобрены" },
  { id: "rejected", label: "Отклонены" },
  { id: "ready_for_pickup", label: "Готовы" },
];

const STATUS_META: Record<
  OrderStatus,
  { label: string; dotClass: string; className: string }
> = {
  pending_approval: {
    label: "На проверке (Rx)",
    dotClass: "bg-amber-600",
    className: "border-amber-300/80 bg-[#fffaeb] text-[#9a5b13]",
  },
  approved: {
    label: "Одобрено",
    dotClass: "bg-emerald-700",
    className: "border-emerald-300/80 bg-[#ecfdf3] text-[#166534]",
  },
  rejected: {
    label: "Отклонено",
    dotClass: "bg-rose-700",
    className: "border-rose-300/80 bg-[#fef3f2] text-[#b42318]",
  },
  ready_for_pickup: {
    label: "Готово к выдаче",
    dotClass: "bg-[#114b46]",
    className: "border-[#114b46]/25 bg-[#e7f1ef] text-[#114b46]",
  },
};

export function PharmacyDashboard({
  orders,
  loading,
  onRefresh,
  onOrderUpdated,
}: PharmacyDashboardProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [notesByOrder, setNotesByOrder] = useState<Record<string, string>>({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredOrders =
    filter === "all"
      ? orders
      : orders.filter((order) => order.status === filter);

  async function handleDecision(
    orderId: string,
    decision: "approve" | "reject",
  ) {
    setBusyOrderId(orderId);
    setActionError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          pharmacistNote: notesByOrder[orderId] ?? "",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload.error || "Не удалось обновить заказ.");
        return;
      }

      onOrderUpdated(orderId, payload.status, payload.pharmacist_note ?? null);
    } catch {
      setActionError("Ошибка сети при отправке решения фармацевта.");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent)]">
            Human-in-the-Loop · Синхронизация с Telegram
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">
            Очередь рецептов фармацевта
          </h2>
          <p className="mt-0.5 text-sm text-[var(--ink-secondary)]">
            Статусы обновляются автоматически каждые 5 секунд после решений в
            Telegram или веб-панели.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-medium text-[var(--ink-primary)] transition hover:bg-[var(--bg-subtle)] disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Обновить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const count =
            option.id === "all"
              ? orders.length
              : orders.filter((order) => order.status === option.id).length;
          const isActive = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
              }`}
            >
              <span>{option.label}</span>
              <span
                className={`font-mono tabular-num text-[11px] ${
                  isActive ? "text-white/80" : "text-[var(--ink-muted)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-[#f2c6c2] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {actionError}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--ink-secondary)]">
          В выбранной категории заказов пока нет.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusInfo = STATUS_META[order.status];
            const isPending = order.status === "pending_approval";
            const isBusy = busyOrderId === order.id;

            return (
              <div key={order.id} className="order-card-shell fade-enter">
                <article className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-hairline)] pb-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-semibold text-[var(--ink-primary)]">
                          {order.order_code}
                        </span>
                        <h3 className="text-base font-semibold text-[var(--ink-primary)]">
                          {order.patient_name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotClass}`}
                            aria-hidden="true"
                          />
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--ink-secondary)]">
                        <span className="font-mono tabular-num">
                          {order.patient_phone}
                        </span>
                        <span>·</span>
                        <span>
                          Аллергии: {order.allergies || "Не указаны"}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-num">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {new Date(order.created_at).toLocaleString("ru-RU")}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
                        Сумма
                      </div>
                      <div className="font-mono tabular-num text-lg font-semibold text-[var(--ink-primary)]">
                        {order.total_kzt.toLocaleString("ru-RU")} ₸
                      </div>
                    </div>
                  </div>

                  <div className="order-card-grid mt-4">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                        Состав назначения
                      </div>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {order.medications.map((med, index) => (
                          <li
                            key={`${order.id}-med-${index}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2"
                          >
                            <span className="min-w-0 font-medium text-[var(--ink-primary)]">
                              {med.prescribed_name}{" "}
                              <span className="font-normal text-xs text-[var(--ink-secondary)]">
                                · {med.schedule}
                              </span>
                            </span>
                            <span className="font-mono tabular-num text-xs font-medium text-[var(--ink-secondary)]">
                              {med.in_stock
                                ? `${(med.price_kzt ?? 0).toLocaleString("ru-RU")} ₸`
                                : "Нет в наличии"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                        Флаги безопасности
                      </div>
                      {order.safety_warnings.length === 0 ? (
                        <p className="mt-2 rounded-xl border border-[#b7e4c7] bg-[var(--success-soft)] px-3 py-2 text-xs font-medium text-[var(--success)]">
                          Критичных конфликтов не выявлено.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {order.safety_warnings.map((warning, index) => (
                            <li
                              key={`${order.id}-warn-${index}`}
                              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                                warning.severity === "high"
                                  ? "border-[#f2c6c2] bg-[var(--danger-soft)] text-[#7a1b14]"
                                  : "border-[#f0d8a8] bg-[var(--warning-soft)] text-[#6d400c]"
                              }`}
                            >
                              <ShieldAlert
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                <strong>{warning.title}:</strong>{" "}
                                {warning.details}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {order.pharmacist_note && (
                    <p className="mt-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs text-[var(--ink-secondary)]">
                      <strong className="text-[var(--ink-primary)]">
                        Решение фармацевта:
                      </strong>{" "}
                      {order.pharmacist_note}
                    </p>
                  )}

                  {isPending && (
                    <div className="order-card-actions mt-4 border-t border-[var(--border-hairline)] pt-3.5">
                      <input
                        type="text"
                        value={notesByOrder[order.id] ?? ""}
                        onChange={(event) =>
                          setNotesByOrder((prev) => ({
                            ...prev,
                            [order.id]: event.target.value,
                          }))
                        }
                        aria-label={`Комментарий фармацевта к заказу ${order.order_code}`}
                        placeholder="Комментарий фармацевта (необязательно)"
                        className="field-input flex-1 rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[#114b46]/15"
                      />
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDecision(order.id, "approve")}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                        >
                          <CheckCircle2
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Одобрить
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDecision(order.id, "reject")}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#f2c6c2] bg-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[#fde2df] disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Отклонить
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
