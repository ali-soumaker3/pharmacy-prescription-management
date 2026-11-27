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

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> =
  {
    pending_approval: {
      label: "На проверке (Rx)",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    approved: {
      label: "Одобрено",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    rejected: {
      label: "Отклонено",
      className: "bg-rose-100 text-rose-800 border-rose-200",
    },
    ready_for_pickup: {
      label: "Готово к выдаче",
      className: "bg-teal-100 text-teal-800 border-teal-200",
    },
  };

export function PharmacyDashboard({
  orders,
  loading,
  onRefresh,
  onOrderUpdated,
}: PharmacyDashboardProps) {
  const [notesByOrder, setNotesByOrder] = useState<Record<string, string>>({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Очередь рецептов и подтверждение фармацевта
          </h2>
          <p className="text-sm text-slate-500">
            Рецептурные заказы можно подтверждать здесь или кнопками в
            Telegram-боте.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Обновить
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
        >
          {actionError}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Пока нет заказов. Отправьте рецепт во вкладке «Проверка рецепта».
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = STATUS_BADGE[order.status];
            const isPending = order.status === "pending_approval";
            const isBusy = busyOrderId === order.id;

            return (
              <article
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {order.order_code} · {order.patient_name}
                      </h3>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Телефон: {order.patient_phone}</span>
                      <span>·</span>
                      <span>Аллергии: {order.allergies || "Не указаны"}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {new Date(order.created_at).toLocaleString("ru-RU")}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Сумма</div>
                    <div className="text-lg font-bold text-slate-900">
                      {order.total_kzt.toLocaleString("ru-RU")} ₸
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Состав рецепта
                    </div>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
                      {order.medications.map((med, index) => (
                        <li
                          key={`${order.id}-med-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5"
                        >
                          <span>
                            {med.prescribed_name}{" "}
                            <span className="text-xs text-slate-500">
                              ({med.schedule})
                            </span>
                          </span>
                          <span className="text-xs font-medium text-slate-600">
                            {med.in_stock
                              ? `${(med.price_kzt ?? 0).toLocaleString("ru-RU")} ₸`
                              : "Нет на складе"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Флаги безопасности
                    </div>
                    {order.safety_warnings.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-700">
                        Критичных конфликтов не выявлено.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {order.safety_warnings.map((warning, index) => (
                          <li
                            key={`${order.id}-warn-${index}`}
                            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"
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
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <strong>Комментарий фармацевта:</strong>{" "}
                    {order.pharmacist_note}
                  </p>
                )}

                {isPending && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
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
                      className="min-w-60 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(order.id, "approve")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Одобрить
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(order.id, "reject")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Отклонить
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
