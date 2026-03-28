"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { Hero } from "@/types/database";

const EMPTY: Partial<Hero> = { title_ar: "", title_he: "", subtitle_ar: "", subtitle_he: "", image_url: "", link_url: "", cta_text_ar: "تسوّق الآن", cta_text_he: "קנה עכשיו", sort_order: 0, active: true };

export default function HeroesPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const { data: heroes, loading, create, update, remove } = useAdminApi<Hero>({ endpoint: "/api/admin/heroes" });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Hero>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (h: Hero) => { setForm({ ...h }); setEditId(h.id); setModal(true); };

  const handleSave = async () => {
    if (!form.title_ar) { show("❌ العنوان مطلوب", "error"); return; }
    try {
      if (editId) { await update(editId, form); show("✅ تم التعديل"); }
      else { await create(form); show("✅ تم الإضافة"); }
      setModal(false);
    } catch (err: unknown) { show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error"); }
  };

  const handleDelete = async () => { if (confirm) { await remove(confirm); show("🗑️ تم"); setConfirm(null); } };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader title="🖼️ بنرات" count={heroes.length} onAdd={openCreate} addLabel="بنر جديد" />

      {heroes.length === 0 ? <EmptyState icon="🖼️" title="لا يوجد بنرات" /> : (
        <div className="space-y-1.5">
          {heroes.map((h) => (
            <div key={h.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
              style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }} onClick={() => openEdit(h)}>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setConfirm(h.id); }}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center">🗑</button>
                <Toggle value={h.active} onChange={async (v) => { await update(h.id, { active: v }); show(v ? "✅" : "⏸️"); }} />
              </div>
              <div className="flex-1 text-right mr-2">
                <div className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{h.title_ar}</div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {h.subtitle_ar} • ترتيب: {h.sort_order}
                </div>
              </div>
              {h.image_url && (
                <div className="w-12 h-8 bg-surface-elevated rounded-lg overflow-hidden flex-shrink-0 ml-2">
                  <img src={h.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل بنر" : "بنر جديد"}
        footer={<button onClick={handleSave} className="btn-primary w-full">{editId ? "💾 حفظ" : "✅ إضافة"}</button>}>
        <FormField label="العنوان (عربي)" required><input className="input" value={form.title_ar || ""} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></FormField>
        <FormField label="العنوان (עברית)"><input className="input" value={form.title_he || ""} onChange={(e) => setForm({ ...form, title_he: e.target.value })} dir="rtl" /></FormField>
        <FormField label="النص الفرعي (عربي)"><input className="input" value={form.subtitle_ar || ""} onChange={(e) => setForm({ ...form, subtitle_ar: e.target.value })} /></FormField>
        <FormField label="النص الفرعي (עברית)"><input className="input" value={form.subtitle_he || ""} onChange={(e) => setForm({ ...form, subtitle_he: e.target.value })} dir="rtl" /></FormField>
        <ImageUpload
          value={form.image_url || ""}
          onChange={(url) => setForm({ ...form, image_url: url })}
          label="صورة البنر"
          dimensions={IMAGE_DIMS.banner}
          previewHeight={120}
        />
        <FormField label="رابط الزر"><input className="input" value={form.link_url || ""} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/store" dir="ltr" /></FormField>
        <div className="flex gap-2">
          <div className="flex-1"><FormField label="نص الزر (عربي)"><input className="input" value={form.cta_text_ar || ""} onChange={(e) => setForm({ ...form, cta_text_ar: e.target.value })} /></FormField></div>
          <div className="flex-1"><FormField label="ترتيب"><input className="input" type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} dir="ltr" /></FormField></div>
        </div>
        <label className="flex items-center gap-1.5 mb-3"><Toggle value={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} /><span className="text-xs text-muted">مفعّل</span></label>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete} title="حذف البنر؟" message="لا يمكن التراجع" />
      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
