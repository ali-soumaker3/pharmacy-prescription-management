"use client";

import type { MedicationInventoryItem } from "@/lib/schemas";

interface InventoryTableProps {
  inventory: MedicationInventoryItem[];
}

export function InventoryTable({ inventory }: InventoryTableProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Склад препаратов аптеки
        </h2>
        <p className="text-sm text-slate-500">
          Используется ИИ для проверки наличия, расчёта стоимости и подбора
          аналогов по действующему веществу.
        </p>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-labelledby="inventory-table-caption"
        className="table-wrapper"
      >
        <table className="inventory-table">
          <caption id="inventory-table-caption" className="sr-only">
            Каталог и остатки лекарственных препаратов на складе аптеки
          </caption>
          <thead>
            <tr>
              <th scope="col">Препарат</th>
              <th scope="col">Действующее вещество</th>
              <th scope="col">Форма и дозировка</th>
              <th scope="col">Отпуск</th>
              <th scope="col">Цена</th>
              <th scope="col">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.name}</th>
                <td>{item.active_ingredient}</td>
                <td>{item.dosage}</td>
                <td>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      item.requires_prescription
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.requires_prescription
                      ? "По рецепту (Rx)"
                      : "Без рецепта (OTC)"}
                  </span>
                </td>
                <td className="font-medium text-slate-900">
                  {item.price_kzt.toLocaleString("ru-RU")} ₸
                </td>
                <td>
                  {item.stock_qty > 5 ? (
                    <span className="font-medium text-emerald-700">
                      {item.stock_qty} уп.
                    </span>
                  ) : item.stock_qty > 0 ? (
                    <span className="font-medium text-amber-700">
                      Мало ({item.stock_qty} уп.)
                    </span>
                  ) : (
                    <span className="font-medium text-rose-700">
                      Нет в наличии
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
