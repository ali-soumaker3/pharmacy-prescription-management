"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CircleHelp,
  ClipboardCheck,
  Cross,
  FileSearch,
  Moon,
  Package,
  Sun,
  X,
} from "lucide-react";
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
type ResolvedTheme = "light" | "dark";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "prescription", label: "Рецепт" },
  { id: "orders", label: "Заказы" },
  { id: "inventory", label: "Склад" },
];

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): ResolvedTheme | null {
  try {
    const stored = localStorage.getItem("color-scheme");
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyThemeMeta(value: ResolvedTheme | null) {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]',
  );
  if (meta) {
    meta.content = value ?? "light dark";
  }
}

export function PharmacyWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("prescription");
  const [orders, setOrders] = useState<PharmacyOrderRecord[]>([]);
  const [inventory, setInventory] = useState<MedicationInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [n8nConfigured, setN8nConfigured] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const helpDialogRef = useRef<HTMLDialogElement | null>(null);

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
    const syncTheme = () => {
      const stored = readStoredTheme();
      applyThemeMeta(stored);
      setResolvedTheme(stored ?? getSystemTheme());
    };

    syncTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const stored = readStoredTheme();
      if (!stored) {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "color-scheme") {
        syncTheme();
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const dialog = helpDialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) {
      return;
    }

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) {
        return;
      }
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
      }
    };

    dialog.addEventListener("click", handleBackdropClick);
    return () => dialog.removeEventListener("click", handleBackdropClick);
  }, []);

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

  function handleToggleTheme() {
    const systemTheme = getSystemTheme();
    const target: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    try {
      if (target === systemTheme) {
        localStorage.removeItem("color-scheme");
        applyThemeMeta(null);
      } else {
        localStorage.setItem("color-scheme", target);
        applyThemeMeta(target);
      }
    } catch {
      applyThemeMeta(target);
    }
    setResolvedTheme(target);
  }

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
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-ink)]">
                <Cross className="h-4 w-4" aria-hidden="true" />
              </div>
              <h1 className="page-title font-semibold text-[var(--ink-primary)]">
                ФармаКонтроль
              </h1>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleTheme}
                aria-label={
                  resolvedTheme === "dark"
                    ? "Включить светлую тему"
                    : "Включить тёмную тему"
                }
                title={
                  resolvedTheme === "dark" ? "Светлая тема" : "Тёмная тема"
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => helpDialogRef.current?.showModal()}
                aria-label="Справка о системе"
                title="Справка"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
              >
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Разделы"
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
                    <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--warning)]">
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
            className="mb-5 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-xs text-[var(--warning)]"
          >
            {warning}
          </div>
        )}

        <section
          aria-label="Сводка"
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              На проверке
            </div>
            <div className="mt-1 font-mono tabular-num text-xl font-semibold text-[var(--ink-primary)]">
              {pendingCount}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Заказы
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
              Нет в наличии
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
          <span>
            ФармаКонтроль{" "}
            <span className="opacity-70">· Алина Сырлыбаева</span>
          </span>
          <a
            href="https://t.me/mnu_pharmacy_bot"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[var(--accent)] underline decoration-current/35 underline-offset-4 hover:decoration-current"
          >
            @mnu_pharmacy_bot
          </a>
        </div>
      </footer>

      <dialog
        ref={helpDialogRef}
        aria-labelledby="help-dialog-title"
        className="help-dialog"
        {...({ closedby: "any" } as Record<string, string>)}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-3.5">
            <div>
              <h2
                id="help-dialog-title"
                className="text-base font-semibold text-[var(--ink-primary)]"
              >
                О системе «ФармаКонтроль»
              </h2>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                Generative AI · ISE MNU
              </p>
            </div>
            <button
              type="button"
              onClick={() => helpDialogRef.current?.close()}
              aria-label="Закрыть справку"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm text-[var(--ink-secondary)]">
            <p>
              Сервис разбирает текст или фото рецепта, проверяет наличие и цены
              по базе аптеки, подбирает дженерики при отсутствии оригинала и
              предупреждает об аллергиях и лекарственных взаимодействиях.
            </p>
            <p>
              Рецептурные (Rx) и рискованные заказы отправляются фармацевту в
              Telegram-бот{" "}
              <a
                href="https://t.me/mnu_pharmacy_bot"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-[var(--accent)] underline underline-offset-4"
              >
                @mnu_pharmacy_bot
              </a>{" "}
              на подтверждение.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-hairline)] pt-3.5 font-mono text-[11px] text-[var(--ink-secondary)]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  supabaseConnected ? "bg-[var(--success)]" : "bg-[var(--ink-muted)]"
                }`}
                aria-hidden="true"
              />
              {supabaseConnected ? "Supabase подключён" : "Демо БД"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  n8nConfigured ? "bg-[var(--accent)]" : "bg-[var(--ink-muted)]"
                }`}
                aria-hidden="true"
              />
              {n8nConfigured ? "n8n активен" : "Локально"}
            </span>
          </div>

          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            Информация носит справочный характер и не заменяет консультацию
            врача.
          </p>
        </div>
      </dialog>
    </div>
  );
}
