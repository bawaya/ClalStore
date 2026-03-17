"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import type { LinePlan } from "@/types/database";

const EMPTY: Partial<LinePlan> = { name_ar: "", name_he: "", data_amount: "", price: 0, features_ar: [], features_he: [], popular: false, active: true, sort_order: 0 };

export default function LinesPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const { data: lines, loading, create, update, remove } = useAdminApi<LinePlan>({ endpoint: "/api/admin/lines" });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<LinePlan>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [featInput, setFeatInput] = useState("");

  const openCreate = () => { setForm(EMPTY); setEditId(null); setFeatInput(""); setModal(true); };
  const openEdit = (l: LinePlan) => { setForm({ ...l }); setEditId(l.id); setFeatInput(""); setModal(true); };

  const addFeature = () => {
    if (!featInput.trim()) return;
    setForm({ ...form, features_ar: [...(form.features_ar || []), featInput.trim()] });
    setFeatInput("");
  };
  const removeFeature = (i: number) => {
    setForm({ ...form, features_ar: (form.features_ar || []).filter((_, idx) => idx !== i) });
  };

  const handleSave = async () => {
    if (!form.name_ar || !form.data_amount || !form.price) { show("❌ عبّي الحقول", "error"); return; }
    try {
      if (editId) { await update(editId, form); show("✅ تم التعديل"); }
      else { await create(form); show("✅ تم الإضافة"); }
      setModal(false);
    } catch (err: any) { show(`❌ ${err.message}`, "error"); }
  };

  const handleDelete = async () => { if (confirm) { await remove(confirm); show("🗑️ تم"); setConfirm(null); } };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader title="📡 باقات HOT Mobile" count={lines.length} onAdd={openCreate} addLabel="باقة جديدة" />

      {lines.length === 0 ? <EmptyState icon="📡" title="لا يوجد باقات" /> : (
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          {lines.map((l) => (
            <div key={l.id} className="card cursor-pointer hover:border-brand/30 relative"
              style={{ padding: scr.mobile ? 14 : 20 }} onClick={() => openEdit(l)}>
              {l.popular && <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-white text-[8px] font-bold px-2.5 py-0.5 rounded-md">⭐ شعبية</div>}
              <div className="flex items-center justify-between mb-1">
                <div className="flex gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); setConfirm(l.id); }}
                    className="w-6 h-6 rounded-md border border-state-error/30 bg-transparent text-state-error text-[10px] cursor-pointer flex items-center justify-center">🗑</button>
                  <Toggle value={l.active} onChange={async (v) => { await update(l.id, { active: v }); show(v ? "✅" : "⏸️"); }} />
                </div>
                <div className="text-right">
                  <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 18 }}>{l.name_ar}</div>
                  <div className="text-muted text-xs">ترتيب: {l.sort_order}</div>
                </div>
              </div>
              <div className="text-center font-black text-brand my-1" style={{ fontSize: scr.mobile ? 22 : 28 }}>{l.data_amount}</div>
              <div className="text-center text-muted mb-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>₪{Number(l.price)}/شهر</div>
              <div className="space-y-0.5">
                {(l.features_ar || []).map((f, i) => (
                  <div key={i} className="text-muted text-center" style={{ fontSize: scr.mobile ? 9 : 11 }}>✓ {f}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل باقة" : "باقة جديدة"}
        footer={<button onClick={handleSave} className="btn-primary w-full">{editId ? "💾 حفظ" : "✅ إضافة"}</button>}>
        <FormField label="الاسم (عربي)" required><input className="input" value={form.name_ar || ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="بريميوم" /></FormField>
        <FormField label="الاسم (עברית)"><input className="input" value={form.name_he || ""} onChange={(e) => setForm({ ...form, name_he: e.target.value })} dir="rtl" /></FormField>
        <div className="flex gap-2">
          <div className="flex-1"><FormField label="كمية الداتا" required><input className="input" value={form.data_amount || ""} onChange={(e) => setForm({ ...form, data_amount: e.target.value })} placeholder="50GB" dir="ltr" /></FormField></div>
          <div className="flex-1"><FormField label="السعر الشهري ₪" required><input className="input" type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} dir="ltr" /></FormField></div>
        </div>
        <FormField label="ترتيب العرض"><input className="input" type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} dir="ltr" /></FormField>

        {/* Features */}
        <FormField label="المميزات">
          <div className="flex gap-1 mb-1.5">
            <button onClick={addFeature} className="px-3 py-2 rounded-lg bg-brand text-white text-xs font-bold cursor-pointer border-0 flex-shrink-0">+</button>
            <input className="input" value={featInput} onChange={(e) => setFeatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFeature()} placeholder="أضف ميزة..." />
          </div>
          <div className="space-y-1">
            {(form.features_ar || []).map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-surface-elevated rounded-lg px-2.5 py-1.5">
                <button onClick={() => removeFeature(i)} className="text-state-error text-xs cursor-pointer bg-transparent border-0">✕</button>
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </FormField>

        <div className="flex gap-3 mb-3">
          <label className="flex items-center gap-1.5 cursor-pointer"><Toggle value={!!form.popular} onChange={(v) => setForm({ ...form, popular: v })} /><span className="text-xs text-muted">⭐ شعبية</span></label>
          <label className="flex items-center gap-1.5 cursor-pointer"><Toggle value={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} /><span className="text-xs text-muted">مفعّل</span></label>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete} title="حذف الباقة؟" message="لا يمكن التراجع" />
      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
