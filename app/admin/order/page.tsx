"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, ToastContainer } from "@/components/admin/shared";
import { csrfHeaders } from "@/lib/csrf-client";
import { useDebounce, useScreen, useToast } from "@/lib/hooks";

type SortableProduct = {
  id: string;
  brand: string;
  name_ar: string;
  name_he?: string | null;
  image_url?: string | null;
  active: boolean;
  type: "device" | "accessory";
  sort_position?: number | null;
  created_at: string;
};

function reorderProductList(
  current: SortableProduct[],
  productId: string,
  direction: "up" | "down" | "top" | "bottom",
) {
  const index = current.findIndex((product) => product.id === productId);
  if (index === -1) return current;

  const next = [...current];
  const [item] = next.splice(index, 1);

  if (direction === "top") {
    next.unshift(item);
    return next;
  }

  if (direction === "bottom") {
    next.push(item);
    return next;
  }

  const targetIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(next.length, index + 1);
  next.splice(targetIndex, 0, item);
  return next;
}

export default function ProductSortPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();

  const [products, setProducts] = useState<SortableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const debouncedSearch = useDebounce(search, 200);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/order");
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || "Failed to load products");
        }
        if (!active) return;
        const rows = json.data?.products || json.products || [];
        setProducts(Array.isArray(rows) ? rows : []);
        setDirty(false);
      } catch (err: unknown) {
        if (!active) return;
        show(`❌ ${err instanceof Error ? err.message : "שגיאה בטעינת המוצרים"}`, "error");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, [show]);

  const filteredProducts = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) =>
      `${product.brand} ${product.name_ar} ${product.name_he || ""}`.toLowerCase().includes(query),
    );
  }, [debouncedSearch, products]);

  const moveProduct = (productId: string, direction: "up" | "down" | "top" | "bottom") => {
    setProducts((current) => reorderProductList(current, productId, direction));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!products.length) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/order", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ orderedIds: products.map((product) => product.id) }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to save product order");
      }
      setDirty(false);
      show("✅ סדר המוצרים נשמר");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה בשמירת הסדר"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="סידור מוצרים בחנות" count={products.length} />

      <div className="mb-4 rounded-2xl border border-surface-border bg-surface-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black">סדר תצוגה אמיתי לסטור</div>
            <div className="mt-1 text-xs text-muted">
              הסטור קורא עכשיו את <span className="font-mono">products.sort_position</span> לפי הסדר שאתם שומרים כאן.
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary disabled:opacity-50">
              {saving ? "שומר..." : "שמור סדר"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
          <span className="text-sm opacity-50">⌕</span>
          <input
            className="flex-1 bg-transparent outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש מוצר לפי מותג או שם"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted">טוען מוצרים...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center text-muted">לא נמצאו מוצרים</div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((product) => {
            const globalIndex = products.findIndex((item) => item.id === product.id);
            const isFirst = globalIndex === 0;
            const isLast = globalIndex === products.length - 1;

            return (
              <div
                key={product.id}
                className="card flex items-center gap-3"
                style={{ padding: scr.mobile ? "12px 14px" : "16px 18px" }}
              >
                <div className="flex gap-1">
                  <button
                    onClick={() => moveProduct(product.id, "top")}
                    disabled={isFirst}
                    className="rounded-lg border border-surface-border px-2 py-1 text-xs disabled:opacity-25"
                  >
                    ⇤
                  </button>
                  <button
                    onClick={() => moveProduct(product.id, "up")}
                    disabled={isFirst}
                    className="rounded-lg border border-surface-border px-2 py-1 text-xs disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveProduct(product.id, "down")}
                    disabled={isLast}
                    className="rounded-lg border border-surface-border px-2 py-1 text-xs disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => moveProduct(product.id, "bottom")}
                    disabled={isLast}
                    className="rounded-lg border border-surface-border px-2 py-1 text-xs disabled:opacity-25"
                  >
                    ⇥
                  </button>
                </div>

                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-bold">{product.brand}</span>
                    <span className="text-sm text-muted">·</span>
                    <span className="font-medium">{product.name_ar}</span>
                    {!product.active && (
                      <span className="rounded-full bg-state-error/10 px-2 py-0.5 text-[10px] font-bold text-state-error">
                        לא פעיל
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    מיקום נוכחי: {globalIndex + 1} · {product.type === "device" ? "מכשיר" : "אביזר"}
                  </div>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-elevated text-xs font-black text-brand">
                  {globalIndex + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
