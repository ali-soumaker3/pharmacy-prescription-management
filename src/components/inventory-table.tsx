"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { MedicationInventoryItem } from "@/lib/schemas";

interface InventoryTableProps {
  inventory: MedicationInventoryItem[];
}

type InventoryFilter = "all" | "in_stock" | "out_of_stock" | "rx" | "otc";

const FILTER_CHIPS: { id: InventoryFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "in_stock", label: "В наличии" },
  { id: "out_of_stock", label: "Нет в наличии" },
  { id: "rx", label: "Rx" },
  { id: "otc", label: "OTC" },
];

export function InventoryTable({ inventory }: InventoryTableProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");

  const filteredInventory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return inventory.filter((item) => {
      if (filter === "in_stock" && item.stock_qty === 0) return false;
      if (filter === "out_of_stock" && item.stock_qty > 0) return false;
      if (filter === "rx" && !item.requires_prescription) return false;
      if (filter === "otc" && item.requires_prescription) return false;

      if (!normalizedQuery) return true;
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.active_ingredient.toLowerCase().includes(normalizedQuery) ||
        item.dosage.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [inventory, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map((chip) => {
            const isActive = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Поиск препарата"
              placeholder="Название или вещество..."
              className="field-input w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] py-1.5 pl-10 pr-9 text-sm text-[var(--ink-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <span className="shrink-0 font-mono tabular-num text-xs text-[var(--ink-muted)]">
            {filteredInventory.length}/{inventory.length}
          </span>
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-labelledby="inventory-table-caption"
        className="table-wrapper"
      >
        <table className="inventory-table">
          <caption id="inventory-table-caption" className="sr-only">
            Каталог и остатки препаратов на складе
          </caption>
          <thead>
            <tr>
              <th scope="col">Препарат</th>
              <th scope="col">Действующее вещество</th>
              <th scope="col">Форма выпуска</th>
              <th scope="col">Отпуск</th>
              <th scope="col">Цена</th>
              <th scope="col">Наличие</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-[var(--ink-muted)]"
                >
                  Ничего не найдено.
                </td>
              </tr>
            ) : (
              filteredInventory.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.name}</th>
                  <td>{item.active_ingredient}</td>
                  <td>{item.dosage}</td>
                  <td>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs font-medium ${
                        item.requires_prescription
                          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                          : "bg-[var(--bg-subtle)] text-[var(--ink-secondary)]"
                      }`}
                    >
                      {item.requires_prescription ? "Rx" : "OTC"}
                    </span>
                  </td>
                  <td className="font-mono tabular-num font-medium text-[var(--ink-primary)]">
                    {item.price_kzt.toLocaleString("ru-RU")} ₸
                  </td>
                  <td>
                    {item.stock_qty > 5 ? (
                      <span className="font-mono tabular-num text-xs font-medium text-[var(--success)]">
                        {item.stock_qty} уп.
                      </span>
                    ) : item.stock_qty > 0 ? (
                      <span className="font-mono tabular-num text-xs font-medium text-[var(--warning)]">
                        {item.stock_qty} уп.
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[var(--danger)]">
                        Нет
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
