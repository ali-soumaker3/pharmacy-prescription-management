"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Activity,
  ClipboardCheck,
  Database,
  FileSearch,
  Package,
  Workflow,
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
  }

  const pendingCount = orders.filter(
    (order) => order.status === "pending_approval",
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white">
              <Activity className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Аптека ИИ — Управление рецептами
              </h1>
              <p className="text-sm text-slate-500">
                Распознавание рецептов, проверка безопасности и подтверждение
                фармацевтом
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                supabaseConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
            >
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              {supabaseConnected ? "Supabase подключён" : "Supabase: демо"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                n8nConfigured
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
            >
              <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
              {n8nConfigured ? "n8n активен" : "n8n: ожидает webhook"}
            </span>
          </div>
        </div>

        {warning && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
            {warning}
          </div>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Разделы управления аптекой"
        onKeyDown={handleTabKeyDown}
        className="workspace-tablist mb-6"
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
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <main>
        <div
          role="tabpanel"
          aria-labelledby="tab-prescription"
          hidden={activeTab !== "prescription"}
        >
          <div>
            <PrescriptionForm onAnalyzed={handlePrescriptionAnalyzed} />
          </div>
        </div>

        <div
          role="tabpanel"
          aria-labelledby="tab-orders"
          hidden={activeTab !== "orders"}
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
        >
          <div>
            <InventoryTable inventory={inventory} />
          </div>
        </div>
      </main>
    </div>
  );
}
