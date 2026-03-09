"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader } from "@/components/admin/shared";

type Product = { id: string; name_ar: string; name_he?: string; brand: string; price: number; image_url?: string };

export default function OrderPage() {
  const scr = useScreen();
  const { show } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [priorityIds, setPriorityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/order");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setProducts(json.products || []);
        setPriorityIds(json.priorityIds || []);
      } catch (err: any) {
        show(`❌ ${err.message}`, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorityIds }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      show("✅ تم الحفظ — الترتيب الجديد يظهر في المتجر والصفحة الرئيسية");
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const selectProduct = (slotIndex: number, productId: string) => {
    const next = [...priorityIds];
    while (next.length <= slotIndex) next.push("");
    next[slotIndex] = productId;
    setPriorityIds(next.slice(0, 3));
    setPickingSlot(null);
  };

  const clearSlot = (slotIndex: number) => {
    const next = priorityIds.filter((_, i) => i !== slotIndex);
    setPriorityIds([...next, "", ""].slice(0, 3));
  };

  const getProduct = (id: string) => products.find((p) => p.id === id);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="📌 ترتيب الأولوية" />
      <p className="text-muted text-sm mb-6">
        اختر 3 منتجات تظهر أولاً في المتجر والصفحة الرئيسية. الأولوية 1 تظهر قبل 2 و 3.
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "repeat(3, 1fr)" }}>
        {[0, 1, 2].map((i) => {
          const pid = priorityIds[i];
          const p = pid ? getProduct(pid) : null;
          return (
            <div key={i} className="card p-4 border-2 border-dashed" style={{ borderColor: p ? "#22c55e40" : "#71717a40" }}>
              <div className="text-[10px] text-muted mb-2 font-bold">الأولوية {i + 1}</div>
              {p ? (
                <div className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-muted">📱</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate" style={{ fontSize: scr.mobile ? 12 : 14 }}>{p.name_ar}</div>
                    <div className="text-brand font-bold">₪{p.price.toLocaleString()}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setPickingSlot(i)} className="btn-outline text-xs px-2 py-1">تغيير</button>
                    <button onClick={() => clearSlot(i)} className="text-state-error text-[10px]">إزالة</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setPickingSlot(i)} className="w-full py-6 border-2 border-dashed border-surface-border rounded-xl text-muted hover:border-brand/50 hover:text-brand transition-colors">
                  اختر منتج
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pickingSlot !== null && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={() => setPickingSlot(null)}>
          <div className="bg-surface-card rounded-2xl max-h-[80vh] overflow-y-auto w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold mb-3">اختر منتج للأولوية {pickingSlot + 1}</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {products.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => selectProduct(pickingSlot, prod.id)}
                  className="flex gap-2 items-center p-2 rounded-xl border border-surface-border hover:border-brand/50 text-right"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg text-muted">📱</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{prod.name_ar}</div>
                    <div className="text-brand text-xs">₪{prod.price.toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setPickingSlot(null)} className="btn-outline w-full mt-4">إلغاء</button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "💾 حفظ الترتيب"}
        </button>
      </div>
    </div>
  );
}
