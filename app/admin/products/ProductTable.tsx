"use client";

import { useScreen } from "@/lib/hooks";
import { Toggle, EmptyState } from "@/components/admin/shared";
import { PRODUCT_TYPES } from "@/lib/constants";
import { calcMargin } from "@/lib/utils";
import type { Product } from "@/types/database";

interface ProductTableProps {
  filtered: Product[];
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  openEdit: (p: Product) => void;
  setConfirm: (id: string | null) => void;
  update: (id: string, data: Partial<Product>) => Promise<void>;
  show: (msg: string, type?: "success" | "error") => void;
  pagination: { page: number; totalPages: number; total: number } | null;
  setPage: (page: number) => void;
}

export function ProductTable({
  filtered, selected, toggleSelect, toggleSelectAll,
  openEdit, setConfirm, update, show,
  pagination, setPage,
}: ProductTableProps) {
  const scr = useScreen();

  if (filtered.length === 0) {
    return <EmptyState icon="📱" title="لا يوجد منتجات" sub="أضف أول منتج" />;
  }

  return (
    <div className="space-y-1.5">
      {/* Select all */}
      <div className="flex items-center gap-2 px-2 py-1">
        <input
          type="checkbox"
          checked={filtered.length > 0 && selected.size === filtered.length}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded cursor-pointer accent-[#e50914] flex-shrink-0"
        />
        <span className="text-[10px] text-muted">تحديد الكل ({filtered.length})</span>
      </div>
      {filtered.map((p) => (
        <div key={p.id} className="card flex items-center gap-2 cursor-pointer hover:border-brand/30 transition-all"
          style={{
            padding: scr.mobile ? "10px 12px" : "14px 18px",
            borderColor: selected.has(p.id) ? "rgba(229,9,20,0.4)" : undefined,
            background: selected.has(p.id) ? "rgba(229,9,20,0.04)" : undefined,
          }}
          onClick={() => openEdit(p)}>

          {/* Checkbox */}
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelect(p.id)}
            className="w-4 h-4 rounded cursor-pointer accent-[#e50914] flex-shrink-0"
          />

          {/* Actions — left side (RTL) */}
          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setConfirm(p.id)}
              className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center flex-shrink-0">🗑</button>
            <Toggle value={p.active} onChange={async (v) => { await update(p.id, { active: v }); show(v ? "✅ مفعّل" : "⏸️ معطّل"); }} />
          </div>

          {/* Price */}
          <div className="text-left flex-shrink-0">
            <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>₪{Number(p.price).toLocaleString()}</div>
            {p.old_price && <div className="text-dim line-through text-[10px]">₪{Number(p.old_price).toLocaleString()}</div>}
          </div>

          {/* Info — center */}
          <div className="flex-1 text-right">
            <div className="font-bold flex items-center gap-1.5 justify-end" style={{ fontSize: scr.mobile ? 12 : 14 }}>
              {p.name_ar}
              {p.featured && <span className="badge bg-brand/15 text-brand">🔥</span>}
              {!p.active && <span className="badge bg-dim/20 text-dim">معطّل</span>}
            </div>
            <div className="text-muted flex items-center gap-1.5 justify-end" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              <span>{PRODUCT_TYPES[p.type as keyof typeof PRODUCT_TYPES]?.icon} {p.brand}</span>
              <span>•</span>
              <span>مخزون: {p.stock === 0 ? <span className="text-state-error">نفذ</span> : p.stock <= 5 ? <span className="text-state-warning">{p.stock}</span> : p.stock}</span>
              <span>•</span>
              <span>بيع: {p.sold}</span>
              {p.type === "accessory" && <>
                <span>•</span>
                <span>هامش: {calcMargin(Number(p.price), Number(p.cost))}%</span>
              </>}
            </div>
          </div>

          {/* Product thumbnail — right side (RTL), first thing user sees */}
          <div className="flex-shrink-0">
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.name_ar}
                className="object-contain rounded-lg bg-surface-elevated"
                style={{ width: scr.mobile ? 44 : 52, height: scr.mobile ? 44 : 52 }}
              />
            ) : (
              <div
                className="rounded-lg border-2 border-dashed border-state-warning/40 bg-state-warning/5 flex items-center justify-center"
                style={{ width: scr.mobile ? 44 : 52, height: scr.mobile ? 44 : 52, fontSize: scr.mobile ? 16 : 20 }}
                title="بحاجة لصورة"
              >
                📷
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-4">
          <button
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
            className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 cursor-pointer disabled:cursor-default hover:bg-surface-elevated"
          >
            ← السابق
          </button>
          <span className="text-sm text-muted">
            صفحة {pagination.page} من {pagination.totalPages} ({pagination.total} منتج)
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
            className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 cursor-pointer disabled:cursor-default hover:bg-surface-elevated"
          >
            التالي →
          </button>
        </div>
      )}
    </div>
  );
}
