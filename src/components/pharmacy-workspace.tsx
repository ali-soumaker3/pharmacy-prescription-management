"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ClipboardCheck, Cross, FileSearch, Package } from "lucide-react";
import type {
  MedicationInventoryItem,
  OrderStatus,
  PharmacyOrderRecord,
  PrescriptionAnalysisResult,
} from "@/lib/schemas";
import { PrescriptionForm } from "@/components/prescription-form";
import { PharmacyDashboard } from "@/components/pharmacy-dashboard";
import { InventoryTable } from "@/components/inventory-table";

type WorkspaceTab = "prescription" | "orders" | "inventory";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "prescription", label: "Проверка рецепта" },
  { id: "orders", label: "Панель фармацевта" },
  { id: "inventory", label: "Склад аптеки" },
];

export function PharmacyWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("prescription");
  const [orders, setOrders] = useState<PharmacyOrderRecord[]>([]);
  const [inventory, setInventory] = useState<MedicationInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [n8nConfigured, setN8nConfigured] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setOrders(data.orders ?? []);
      setInventory(data.inventory ?? []);
      setSupabaseConnected(Boolean(data.supabaseConnected));
      setN8nConfigured(Boolean(data.n8nConfigured));
      setWarning(data.warning ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const pendingCount = orders.filter(
    (order) => order.status === "pending_approval",
  ).length;
  const inStockCount = inventory.filter((item) => item.stock_qty > 0).length;
  const outOfStockCount = inventory.length - inStockCount;

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const shouldPoll = activeTab !== "prescription" || pendingCount > 0;
    if (!shouldPoll) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadData();
      }
    }, 4500);

    return () => window.clearInterval(timer);
  }, [activeTab, pendingCount, loadData]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }

  function handlePrescriptionAnalyzed(result: PrescriptionAnalysisResult) {
    const newRecord: PharmacyOrderRecord = {
      id: result.order_id,
      order_code: result.order_code,
      patient_name: result.patient_name,
      patient_phone: result.patient_phone,
      allergies: result.allergies,
      raw_prescription: "",
      status: result.status,
      requires_pharmacist_approval: result.requires_pharmacist_approval,
      total_kzt: result.total_kzt,
      medications: result.medications,
      safety_warnings: result.safety_warnings,
      patient_instructions: result.patient_instructions,
      pharmacist_note: null,
      created_at: result.created_at,
    };

    setOrders((prev) => [
      newRecord,
      ...prev.filter((item) => item.id !== newRecord.id),
    ]);
  }

  function handleOrderUpdated(
    orderId: string,
    status: OrderStatus,
    note: string | null,
  ) {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? { ...order, status, pharmacist_note: note }
          : order,
      ),
    );
    if (supabaseConnected) {
      void loadData();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky-topbar">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
                <Cross className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="page-title font-semibold text-[var(--ink-primary)]">
                  ФармаКонтроль
                </h1>
                <p className="hidden text-xs text-[var(--ink-secondary)] sm:block">
                  Проверка рецептов, контроль безопасности и склад аптеки
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--ink-secondary)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    supabaseConnected ? "bg-emerald-600" : "bg-slate-400"
                  }`}
                  aria-hidden="true"
                />
                {supabaseConnected ? "Supabase" : "Демо БД"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--ink-secondary)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    n8nConfigured ? "bg-[var(--accent)]" : "bg-slate-400"
                  }`}
                  aria-hidden="true"
                />
                {n8nConfigured ? "n8n · AI" : "Локально"}
              </span>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Разделы управления аптекой"
            onKeyDown={handleTabKeyDown}
            className="workspace-tablist -mb-px"
          >
            {TABS.map((tab, index) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className="workspace-tab inline-flex items-center gap-2"
                >
                  {tab.id === "prescription" && (
                    <FileSearch className="h-4 w-4" aria-hidden="true" />
                  )}
                  {tab.id === "orders" && (
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  {tab.id === "inventory" && (
                    <Package className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{tab.label}</span>
                  {tab.id === "orders" && pendingCount > 0 && (
                    <span className="rounded-full bg-[#fffaeb] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#9a5b13] ring-1 ring-amber-300/80">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {warning && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-[#f0d8a8] bg-[var(--warning-soft)] px-4 py-3 text-xs text-[#6d400c]"
          >
            {warning}
          </div>
        )}

        <section
          aria-label="Сводка аптеки"
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              На проверке Rx
            </div>
            <div className="mt-1 font-mono tabular-num text-xl font-semibold text-[var(--ink-primary)]">
              {pendingCount}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Всего заказов
            </div>
            <div className="mt-1 font-mono tabular-num text-xl font-semibold text-[var(--ink-primary)]">
              {orders.length}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              В наличии
            </div>
            <div className="mt-1 font-mono tabular-num text-xl font-semibold text-[var(--success)]">
              {inStockCount}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Под замену (0 уп.)
            </div>
            <div className="mt-1 font-mono tabular-num text-xl font-semibold text-[var(--warning)]">
              {outOfStockCount}
            </div>
          </div>
        </section>

        <main className="tab-panels-stack">
          <div
            role="tabpanel"
            aria-labelledby="tab-prescription"
            hidden={activeTab !== "prescription"}
            className="tab-panel"
          >
            <div>
              <PrescriptionForm
                orders={orders}
                inventoryCount={inventory.length}
                onAnalyzed={handlePrescriptionAnalyzed}
                onOpenPharmacistPanel={() => setActiveTab("orders")}
              />
            </div>
          </div>

          <div
            role="tabpanel"
            aria-labelledby="tab-orders"
            hidden={activeTab !== "orders"}
            className="tab-panel"
          >
            <div>
              <PharmacyDashboard
                orders={orders}
                loading={loading}
                onRefresh={loadData}
                onOrderUpdated={handleOrderUpdated}
              />
            </div>
          </div>

          <div
            role="tabpanel"
            aria-labelledby="tab-inventory"
            hidden={activeTab !== "inventory"}
            className="tab-panel"
          >
            <div>
              <InventoryTable inventory={inventory} />
            </div>
          </div>
        </main>
      </div>

      <footer className="mt-10 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/70 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-[var(--ink-muted)] sm:px-6 lg:px-8">
          <span>ФармаКонтроль · Generative AI · ISE MNU</span>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://t.me/mnu_pharmacy_bot"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[var(--accent)] underline decoration-[var(--accent)]/35 underline-offset-4 hover:decoration-[var(--accent)]"
            >
              @mnu_pharmacy_bot
            </a>
            <span>·</span>
            <span>Справочный ИИ-ассистент · Human-in-the-Loop</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
