"use client";

export const dynamic = 'force-dynamic';

// =====================================================
// ClalMobile — Admin Deals Management
// CRUD for special offers / deals
// =====================================================

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { Modal, PageHeader, FormField, Toggle, EmptyState, ConfirmDialog } from "@/components/admin/shared";

interface Deal {
  id: string;
  title_ar: string;
  title_he: string;
  description_ar?: string;
  description_he?: string;
  product_id?: string;
  deal_type: string;
  discount_percent: number;
  discount_amount: number;
  original_price?: number;
  deal_price?: number;
  image_url?: string;
  badge_text_ar?: string;
  badge_text_he?: string;
  starts_at: string;
  ends_at?: string;
  max_quantity: number;
  sold_count: number;
  active: boolean;
  sort_order: number;
}

const DEAL_TYPES = [
  { value: "discount", label: "خصم عادي", icon: "🏷️" },
  { value: "flash_sale", label: "فلاش سيل", icon: "⚡" },
  { value: "bundle", label: "حزمة", icon: "📦" },
  { value: "clearance", label: "تصفية", icon: "🔻" },
];

const emptyDeal: Partial<Deal> = {
  title_ar: "", title_he: "", description_ar: "", description_he: "",
  deal_type: "discount", discount_percent: 0, discount_amount: 0,
  original_price: 0, deal_price: 0, image_url: "",
  badge_text_ar: "🔥 عرض خاص", badge_text_he: "🔥 מבצע",
  max_quantity: 0, active: true, sort_order: 0,
};

export default function AdminDealsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDeal, setEditDeal] = useState<Partial<Deal> | null>(null);
  const [deleteDeal, setDeleteDeal] = useState<Deal | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    loadProducts();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/deals?admin=true");
      const json = await res.json();
      setDeals(json.deals || []);
    } catch {}
    setLoading(false);
  };

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/admin/products");
      const json = await res.json();
      setProducts(json.products || json || []);
    } catch {}
  };

  const saveDeal = async () => {
    if (!editDeal?.title_ar) { show("يرجى إدخال عنوان العرض", "error"); return; }
    setSaving(true);
    try {
      const isNew = !editDeal.id;
      const method = isNew ? "POST" : "PUT";
      const body = isNew ? editDeal : { id: editDeal.id, ...editDeal };

      const res = await fetch("/api/admin/deals", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Save failed");
      show(isNew ? "✅ تم إنشاء العرض" : "✅ تم تعديل العرض");
      setEditDeal(null);
      load();
    } catch {
      show("❌ خطأ في الحفظ", "error");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteDeal) return;
    try {
      await fetch(`/api/admin/deals?id=${deleteDeal.id}`, { method: "DELETE" });
      show("🗑️ تم حذف العرض");
      setDeleteDeal(null);
      load();
    } catch {
      show("❌ خطأ في الحذف", "error");
    }
  };

  const toggleActive = async (deal: Deal) => {
    try {
      await fetch("/api/admin/deals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id, active: !deal.active }),
      });
      load();
    } catch {}
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader
        title="🔥 إدارة العروض"
        count={deals.length}
        onAdd={() => setEditDeal({ ...emptyDeal })}
        addLabel="عرض جديد"
      />

      {deals.length === 0 ? (
        <EmptyState icon="🏷️" title="لا توجد عروض بعد" />
      ) : (
        <div className="space-y-2">
          {deals.map((d) => (
            <div key={d.id} className="card flex items-center gap-3" style={{ padding: scr.mobile ? 10 : 14, opacity: d.active ? 1 : 0.5 }}>
              {/* Image */}
              <div className="w-12 h-12 bg-surface-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                {d.image_url ? (
                  <img src={d.image_url} alt="" className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-2xl">🔥</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-right min-w-0">
                <div className="font-bold truncate" style={{ fontSize: scr.mobile ? 12 : 14 }}>{d.title_ar}</div>
                <div className="flex gap-2 text-[10px] text-muted">
                  <span>{DEAL_TYPES.find((t) => t.value === d.deal_type)?.icon} {DEAL_TYPES.find((t) => t.value === d.deal_type)?.label}</span>
                  {d.discount_percent > 0 && <span className="text-brand font-bold">-{d.discount_percent}%</span>}
                  {d.deal_price !== undefined && d.deal_price > 0 && <span className="text-brand font-bold">₪{d.deal_price}</span>}
                  {d.ends_at && <span>⏰ {new Date(d.ends_at).toLocaleDateString("ar")}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Toggle value={d.active} onChange={() => toggleActive(d)} />
                <button onClick={() => setEditDeal({ ...d })} className="text-brand text-xs font-bold px-2 py-1 hover:bg-surface-elevated rounded">✏️</button>
                <button onClick={() => setDeleteDeal(d)} className="text-state-error text-xs font-bold px-2 py-1 hover:bg-surface-elevated rounded">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
        <Modal open={!!editDeal} onClose={() => setEditDeal(null)} title={editDeal?.id ? "✏️ تعديل العرض" : "➕ عرض جديد"}
          footer={editDeal ? <button onClick={saveDeal} disabled={saving} className="btn-primary w-full text-sm py-2.5 rounded-xl font-bold disabled:opacity-50">
              {saving ? "⏳ جاري الحفظ..." : editDeal.id ? "💾 حفظ التعديلات" : "✅ إنشاء العرض"}
            </button> : undefined}>
          {editDeal && <div className="space-y-3 p-1">
            <FormField label="عنوان العرض (عربي) *">
              <input className="input text-xs" value={editDeal.title_ar || ""} onChange={(e) => setEditDeal({ ...editDeal, title_ar: e.target.value })} dir="auto" />
            </FormField>
            <FormField label="عنوان العرض (عبري)">
              <input className="input text-xs" value={editDeal.title_he || ""} onChange={(e) => setEditDeal({ ...editDeal, title_he: e.target.value })} dir="auto" />
            </FormField>
            <FormField label="الوصف (عربي)">
              <textarea className="input text-xs min-h-[50px] resize-y" value={editDeal.description_ar || ""} onChange={(e) => setEditDeal({ ...editDeal, description_ar: e.target.value })} dir="auto" />
            </FormField>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="نوع العرض">
                <select className="input text-xs" value={editDeal.deal_type} onChange={(e) => setEditDeal({ ...editDeal, deal_type: e.target.value })}>
                  {DEAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </FormField>
              <FormField label="المنتج (اختياري)">
                <select className="input text-xs" value={editDeal.product_id || ""} onChange={(e) => setEditDeal({ ...editDeal, product_id: e.target.value || undefined })}>
                  <option value="">— بدون منتج —</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <FormField label="نسبة الخصم %">
                <input className="input text-xs" type="number" value={editDeal.discount_percent || 0} onChange={(e) => setEditDeal({ ...editDeal, discount_percent: +e.target.value })} dir="ltr" />
              </FormField>
              <FormField label="سعر أصلي ₪">
                <input className="input text-xs" type="number" value={editDeal.original_price || 0} onChange={(e) => setEditDeal({ ...editDeal, original_price: +e.target.value })} dir="ltr" />
              </FormField>
              <FormField label="سعر العرض ₪">
                <input className="input text-xs" type="number" value={editDeal.deal_price || 0} onChange={(e) => setEditDeal({ ...editDeal, deal_price: +e.target.value })} dir="ltr" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="رابط الصورة">
                <input className="input text-xs" value={editDeal.image_url || ""} onChange={(e) => setEditDeal({ ...editDeal, image_url: e.target.value })} dir="ltr" placeholder="https://..." />
              </FormField>
              <FormField label="الكمية المحدودة (0 = بلا حد)">
                <input className="input text-xs" type="number" value={editDeal.max_quantity || 0} onChange={(e) => setEditDeal({ ...editDeal, max_quantity: +e.target.value })} dir="ltr" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="تاريخ البدء">
                <input className="input text-xs" type="datetime-local" value={editDeal.starts_at ? new Date(editDeal.starts_at).toISOString().slice(0, 16) : ""} onChange={(e) => setEditDeal({ ...editDeal, starts_at: new Date(e.target.value).toISOString() })} dir="ltr" />
              </FormField>
              <FormField label="تاريخ الانتهاء">
                <input className="input text-xs" type="datetime-local" value={editDeal.ends_at ? new Date(editDeal.ends_at).toISOString().slice(0, 16) : ""} onChange={(e) => setEditDeal({ ...editDeal, ends_at: new Date(e.target.value).toISOString() })} dir="ltr" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="شارة (عربي)">
                <input className="input text-xs" value={editDeal.badge_text_ar || ""} onChange={(e) => setEditDeal({ ...editDeal, badge_text_ar: e.target.value })} dir="auto" />
              </FormField>
              <FormField label="شارة (عبري)">
                <input className="input text-xs" value={editDeal.badge_text_he || ""} onChange={(e) => setEditDeal({ ...editDeal, badge_text_he: e.target.value })} dir="auto" />
              </FormField>
            </div>

          </div>}
        </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
          open={!!deleteDeal}
          title="حذف العرض"
          message={`هل أنت متأكد من حذف "${deleteDeal?.title_ar}"?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteDeal(null)}
        />

      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
