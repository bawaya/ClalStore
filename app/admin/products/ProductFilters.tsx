"use client";

import type { Product } from "@/types/database";

interface ProductFiltersProps {
  // Stock distribution
  stockMode: boolean;
  setStockMode: (v: boolean) => void;
  distributing: boolean;
  distributeStock: (mode: string) => Promise<void>;
  // Type/stock filter
  filter: string;
  setFilter: (v: string) => void;
  // Brand filter
  brandFilter: string;
  setBrandFilter: (v: string) => void;
  adminBrands: string[];
  // Bulk actions
  selected: Set<string>;
  setSelected: (v: Set<string>) => void;
  setBulkConfirm: (v: boolean) => void;
  bulkDeleting: boolean;
  filteredCount: number;
}

export function ProductFilters({
  stockMode, setStockMode, distributing, distributeStock,
  filter, setFilter,
  brandFilter, setBrandFilter, adminBrands,
  selected, setSelected, setBulkConfirm, bulkDeleting, filteredCount,
}: ProductFiltersProps) {
  return (
    <>
      {/* Stock Distribution Tool */}
      <div className="mb-3">
        <button onClick={() => setStockMode(!stockMode)}
          className="chip chip-active flex items-center gap-1">
          📦 توزيع المخزون
        </button>
        {stockMode && (
          <div className="card mt-2 p-3">
            <p className="text-sm text-muted mb-2">اختر نمط توزيع المخزون على جميع المنتجات النشطة:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { mode: "scarce",    icon: "🔴", label: "شحيح",  desc: "2-5 قطع" },
                { mode: "medium",    icon: "🟡", label: "متوسط", desc: "4-9 قطع" },
                { mode: "available", icon: "🟢", label: "متوفر", desc: "7-13 قطعة" },
                { mode: "abundant",  icon: "🔵", label: "وفير",  desc: "10-15 قطعة" },
              ].map((m) => (
                <button key={m.mode} onClick={() => !distributing && distributeStock(m.mode)}
                  disabled={distributing}
                  className="card p-3 text-center hover:border-brand/40 transition-all cursor-pointer disabled:opacity-50">
                  <div className="text-2xl mb-1">{m.icon}</div>
                  <div className="font-bold text-sm">{m.label}</div>
                  <div className="text-xs text-muted">{m.desc}</div>
                </button>
              ))}
            </div>
            {distributing && <p className="text-center text-muted text-xs mt-2">⏳ جاري التوزيع...</p>}
          </div>
        )}
      </div>

      {/* Filters — Type + Stock */}
      <div className="flex gap-1 mb-2 overflow-x-auto">
        {[
          { k: "all", l: "الكل" }, { k: "device", l: "📱 أجهزة" },
          { k: "accessory", l: "🔌 إكسسوارات" }, { k: "low", l: "⚠️ مخزون منخفض" },
          { k: "out", l: "❌ نفذ" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`chip whitespace-nowrap ${filter === f.k ? "chip-active" : ""}`}>{f.l}</button>
        ))}
      </div>

      {/* Filters — Brand */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        <button onClick={() => setBrandFilter("all")}
          className={`chip whitespace-nowrap ${brandFilter === "all" ? "chip-active" : ""}`}>كل الشركات</button>
        {adminBrands.map((b) => (
          <button key={b} onClick={() => setBrandFilter(b)}
            className={`chip whitespace-nowrap ${brandFilter === b ? "chip-active" : ""}`}>{b}</button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-30 mb-2 card flex items-center justify-between gap-3"
          style={{ padding: "10px 14px", background: "rgba(229,9,20,0.08)", borderColor: "rgba(229,9,20,0.3)" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkConfirm(true)}
              disabled={bulkDeleting}
              className="py-1.5 px-4 rounded-lg bg-state-error text-white text-xs font-bold cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              {bulkDeleting ? "⏳ جاري الحذف..." : `🗑️ حذف ${selected.size} منتج`}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="py-1.5 px-3 rounded-lg border border-surface-border bg-transparent text-muted text-xs cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
          <span className="text-xs font-bold text-brand">{selected.size} محدد</span>
        </div>
      )}
    </>
  );
}
