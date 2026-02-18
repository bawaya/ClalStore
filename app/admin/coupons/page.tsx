"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import { formatDate } from "@/lib/utils";
import type { Coupon } from "@/types/database";

const EMPTY: Partial<Coupon> = { code: "", type: "percent", value: 10, min_order: 0, max_uses: 0, active: true };

export default function CouponsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const { data: coupons, loading, create, update, remove } = useAdminApi<Coupon>({ endpoint: "/api/admin/coupons" });

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Coupon>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (c: Coupon) => { setForm({ ...c }); setEditId(c.id); setModal(true); };

  const handleSave = async () => {
    if (!form.code || !form.value) { show("❌ عبّي الحقول", "error"); return; }
    try {
      const data = { ...form, code: form.code?.toUpperCase() };
      if (editId) { await update(editId, data); show("✅ تم التعديل"); }
      else { await create(data); show("✅ تم الإضافة"); }
      setModal(false);
    } catch (err: any) { show(`❌ ${err.message}`, "error"); }
  };

  const handleDelete = async () => { if (confirm) { await remove(confirm); show("🗑️ تم الحذف"); setConfirm(null); } };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader title="🏷️ كوبونات" count={coupons.length} onAdd={openCreate} addLabel="كوبون جديد" />

      {coupons.length === 0 ? <EmptyState icon="🏷️" title="لا يوجد كوبونات" /> : (
        <div className="space-y-1.5">
          {coupons.map((c) => (
            <div key={c.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
              style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }} onClick={() => openEdit(c)}>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setConfirm(c.id); }}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center">🗑</button>
                <Toggle value={c.active} onChange={async (v) => { await update(c.id, { active: v }); show(v ? "✅" : "⏸️"); }} />
              </div>
              <div className="flex-1 text-right mr-2">
                <div className="font-bold font-mono" style={{ fontSize: scr.mobile ? 14 : 16 }}>{c.code}</div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {c.type === "percent" ? `${c.value}%` : `₪${c.value}`}
                  {c.min_order > 0 && ` • حد أدنى ₪${c.min_order}`}
                  {c.max_uses > 0 && ` • ${c.used_count}/${c.max_uses} استخدام`}
                  {c.expires_at && ` • حتى ${formatDate(c.expires_at)}`}
                </div>
              </div>
              <span className="font-black text-brand mr-3" style={{ fontSize: scr.mobile ? 18 : 24 }}>
                {c.type === "percent" ? `${c.value}%` : `₪${c.value}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل كوبون" : "كوبون جديد"}>
        <FormField label="الكود" required>
          <input className="input font-mono" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" dir="ltr" />
        </FormField>
        <FormField label="النوع">
          <div className="flex gap-1.5">
            <button onClick={() => setForm({ ...form, type: "percent" })} className={`chip flex-1 ${form.type === "percent" ? "chip-active" : ""}`}>% نسبة</button>
            <button onClick={() => setForm({ ...form, type: "fixed" })} className={`chip flex-1 ${form.type === "fixed" ? "chip-active" : ""}`}>₪ مبلغ ثابت</button>
          </div>
        </FormField>
        <FormField label={form.type === "percent" ? "النسبة %" : "المبلغ ₪"} required>
          <input className="input" type="number" value={form.value || ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} dir="ltr" />
        </FormField>
        <div className="flex gap-2">
          <div className="flex-1"><FormField label="حد أدنى للطلب ₪"><input className="input" type="number" value={form.min_order || 0} onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })} dir="ltr" /></FormField></div>
          <div className="flex-1"><FormField label="حد أقصى استخدام (0=غير محدود)"><input className="input" type="number" value={form.max_uses || 0} onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} dir="ltr" /></FormField></div>
        </div>
        <FormField label="تاريخ الانتهاء (اختياري)">
          <input className="input" type="date" value={form.expires_at?.slice(0, 10) || ""} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} dir="ltr" />
        </FormField>
        <label className="flex items-center gap-1.5 mb-3"><Toggle value={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} /><span className="text-xs text-muted">مفعّل</span></label>
        <button onClick={handleSave} className="btn-primary w-full">{editId ? "💾 حفظ" : "✅ إضافة"}</button>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete} title="حذف الكوبون؟" message="لا يمكن التراجع عن هذا الإجراء" />
      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
