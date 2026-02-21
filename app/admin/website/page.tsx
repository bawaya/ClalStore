"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader, Modal, FormField, Toggle, EmptyState } from "@/components/admin/shared";
import type { WebsiteContent } from "@/types/database";

// Section display names
const SECTION_META: Record<string, { icon: string; label: string }> = {
  hero: { icon: "🏠", label: "الهيرو (البطل)" },
  stats: { icon: "📊", label: "الإحصائيات" },
  features: { icon: "⭐", label: "المميزات" },
  faq: { icon: "❓", label: "أسئلة شائعة" },
  cta: { icon: "📣", label: "الدعوة للعمل (CTA)" },
  footer: { icon: "📋", label: "الفوتر" },
};

export default function WebsiteContentPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [sections, setSections] = useState<WebsiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editSection, setEditSection] = useState<WebsiteContent | null>(null);
  const [form, setForm] = useState<Partial<WebsiteContent>>({});
  const [saving, setSaving] = useState(false);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSections(json.data || []);
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const openEdit = (s: WebsiteContent) => {
    setEditSection(s);
    setForm({ ...s });
    setModal(true);
  };

  const updateContent = (key: string, value: any) => {
    setForm(prev => ({
      ...prev,
      content: { ...(prev.content || {}), [key]: value },
    }));
  };

  const updateContentItem = (key: string, index: number, field: string, value: string) => {
    const items = [...((form.content as any)?.[key] || [])];
    items[index] = { ...items[index], [field]: value };
    updateContent(key, items);
  };

  const addContentItem = (key: string, template: Record<string, string>) => {
    const items = [...((form.content as any)?.[key] || []), template];
    updateContent(key, items);
  };

  const removeContentItem = (key: string, index: number) => {
    const items = [...((form.content as any)?.[key] || [])];
    items.splice(index, 1);
    updateContent(key, items);
  };

  const handleSave = async () => {
    if (!editSection) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editSection.id, ...form }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      show("✅ تم الحفظ");
      setModal(false);
      await fetchSections();
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader title="🌐 محتوى الموقع" count={sections.length} />

      {sections.length === 0 ? (
        <EmptyState icon="🌐" title="لا يوجد محتوى" sub="قم بتنفيذ Migration 009 أولاً" />
      ) : (
        <div className="space-y-1.5">
          {sections.map((s) => {
            const meta = SECTION_META[s.section] || { icon: "📝", label: s.section };
            return (
              <div key={s.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
                style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
                onClick={() => openEdit(s)}>
                <div className="flex gap-2 items-center">
                  <span className="text-muted text-[11px]">✏️ تعديل</span>
                  <Toggle value={s.is_visible} onChange={async (v) => {
                    try {
                      await fetch("/api/admin/website", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: s.id, is_visible: v }),
                      });
                      await fetchSections();
                      show(v ? "✅ مرئي" : "⏸️ مخفي");
                    } catch { show("❌ خطأ", "error"); }
                  }} />
                </div>
                <div className="flex-1 text-right mr-2">
                  <div className="font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>
                    {meta.icon} {meta.label}
                  </div>
                  <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                    {s.section} • ترتيب: {s.sort_order} • آخر تعديل: {s.updated_at ? new Date(s.updated_at).toLocaleDateString("ar") : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={`تعديل: ${editSection ? (SECTION_META[editSection.section]?.label || editSection.section) : ""}`}>
        {editSection && (
          <div className="space-y-3">
            {/* Common fields */}
            {editSection.section !== "stats" && editSection.section !== "features" && editSection.section !== "faq" && (
              <>
                <FormField label="العنوان (عربي)">
                  <input className="input" value={form.title_ar || ""} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
                </FormField>
                <FormField label="العنوان (עברית)">
                  <input className="input" value={form.title_he || ""} onChange={(e) => setForm({ ...form, title_he: e.target.value })} dir="rtl" />
                </FormField>
              </>
            )}

            {/* Section-specific content editors */}
            {editSection.section === "hero" && <HeroEditor content={form.content || {}} onChange={updateContent} />}
            {editSection.section === "stats" && <StatsEditor content={form.content || {}} onUpdateItem={updateContentItem} onAdd={addContentItem} onRemove={removeContentItem} />}
            {editSection.section === "features" && <FeaturesEditor content={form.content || {}} onUpdateItem={updateContentItem} onAdd={addContentItem} onRemove={removeContentItem} />}
            {editSection.section === "faq" && <FAQEditor content={form.content || {}} onUpdateItem={updateContentItem} onAdd={addContentItem} onRemove={removeContentItem} />}
            {editSection.section === "cta" && <CTAEditor content={form.content || {}} onChange={updateContent} />}
            {editSection.section === "footer" && <FooterEditor content={form.content || {}} onChange={updateContent} />}

            {/* Visibility + Sort */}
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-1.5">
                <Toggle value={form.is_visible !== false} onChange={(v) => setForm({ ...form, is_visible: v })} />
                <span className="text-xs text-muted">مرئي</span>
              </label>
              <div className="flex-1">
                <FormField label="ترتيب">
                  <input className="input" type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} dir="ltr" />
                </FormField>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
            </button>
          </div>
        )}
      </Modal>

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div key={t.id} className="bg-surface-elevated text-white text-sm px-4 py-2 rounded-xl shadow-xl border border-surface-border">
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Section-Specific Editors =====

function HeroEditor({ content, onChange }: { content: Record<string, any>; onChange: (key: string, val: any) => void }) {
  return (
    <div className="space-y-2 bg-surface-elevated/50 p-3 rounded-xl border border-surface-border">
      <div className="text-xs font-bold text-brand mb-2">🏠 محتوى الهيرو</div>
      <FormField label="شارة (عربي)"><input className="input" value={content.badge_ar || ""} onChange={(e) => onChange("badge_ar", e.target.value)} /></FormField>
      <FormField label="شارة (עברית)"><input className="input" value={content.badge_he || ""} onChange={(e) => onChange("badge_he", e.target.value)} dir="rtl" /></FormField>
      <FormField label="الوصف (عربي)"><textarea className="input" rows={2} value={content.description_ar || ""} onChange={(e) => onChange("description_ar", e.target.value)} /></FormField>
      <FormField label="الوصف (עברית)"><textarea className="input" rows={2} value={content.description_he || ""} onChange={(e) => onChange("description_he", e.target.value)} dir="rtl" /></FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="زر المتجر (عربي)"><input className="input" value={content.cta_store_ar || ""} onChange={(e) => onChange("cta_store_ar", e.target.value)} /></FormField>
        <FormField label="زר החנות (עברית)"><input className="input" value={content.cta_store_he || ""} onChange={(e) => onChange("cta_store_he", e.target.value)} dir="rtl" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="زر الباقات (عربي)"><input className="input" value={content.cta_plans_ar || ""} onChange={(e) => onChange("cta_plans_ar", e.target.value)} /></FormField>
        <FormField label="כפתור חבילות (עברית)"><input className="input" value={content.cta_plans_he || ""} onChange={(e) => onChange("cta_plans_he", e.target.value)} dir="rtl" /></FormField>
      </div>
      <FormField label="صورة خلفية (URL)"><input className="input" value={content.bg_image || ""} onChange={(e) => onChange("bg_image", e.target.value)} placeholder="https://..." dir="ltr" /></FormField>
    </div>
  );
}

function StatsEditor({ content, onUpdateItem, onAdd, onRemove }: { content: Record<string, any>; onUpdateItem: (key: string, i: number, f: string, v: string) => void; onAdd: (key: string, tmpl: Record<string, string>) => void; onRemove: (key: string, i: number) => void }) {
  const items = content.items || [];
  return (
    <div className="space-y-2 bg-surface-elevated/50 p-3 rounded-xl border border-surface-border">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onAdd("items", { value: "", label_ar: "", label_he: "", icon: "📌" })}
          className="text-xs text-brand cursor-pointer bg-transparent border-0">+ إضافة</button>
        <div className="text-xs font-bold text-brand">📊 الإحصائيات</div>
      </div>
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-surface-bg p-2 rounded-lg border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between">
            <button onClick={() => onRemove("items", i)} className="text-[10px] text-state-error cursor-pointer bg-transparent border-0">✕</button>
            <span className="text-[11px] text-muted">إحصاء #{i + 1}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <FormField label="أيقونة"><input className="input" value={item.icon || ""} onChange={(e) => onUpdateItem("items", i, "icon", e.target.value)} /></FormField>
            <FormField label="القيمة"><input className="input" value={item.value || ""} onChange={(e) => onUpdateItem("items", i, "value", e.target.value)} dir="ltr" /></FormField>
          </div>
          <FormField label="النص (عربي)"><input className="input" value={item.label_ar || ""} onChange={(e) => onUpdateItem("items", i, "label_ar", e.target.value)} /></FormField>
          <FormField label="הטקסט (עברית)"><input className="input" value={item.label_he || ""} onChange={(e) => onUpdateItem("items", i, "label_he", e.target.value)} dir="rtl" /></FormField>
        </div>
      ))}
    </div>
  );
}

function FeaturesEditor({ content, onUpdateItem, onAdd, onRemove }: { content: Record<string, any>; onUpdateItem: (key: string, i: number, f: string, v: string) => void; onAdd: (key: string, tmpl: Record<string, string>) => void; onRemove: (key: string, i: number) => void }) {
  const items = content.items || [];
  return (
    <div className="space-y-2 bg-surface-elevated/50 p-3 rounded-xl border border-surface-border">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onAdd("items", { icon: "⭐", title_ar: "", title_he: "", desc_ar: "", desc_he: "" })}
          className="text-xs text-brand cursor-pointer bg-transparent border-0">+ إضافة</button>
        <div className="text-xs font-bold text-brand">⭐ المميزات</div>
      </div>
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-surface-bg p-2 rounded-lg border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between">
            <button onClick={() => onRemove("items", i)} className="text-[10px] text-state-error cursor-pointer bg-transparent border-0">✕</button>
            <span className="text-[11px] text-muted">ميزة #{i + 1}</span>
          </div>
          <FormField label="أيقونة"><input className="input" value={item.icon || ""} onChange={(e) => onUpdateItem("items", i, "icon", e.target.value)} /></FormField>
          <FormField label="العنوان (عربي)"><input className="input" value={item.title_ar || ""} onChange={(e) => onUpdateItem("items", i, "title_ar", e.target.value)} /></FormField>
          <FormField label="הכותרת (עברית)"><input className="input" value={item.title_he || ""} onChange={(e) => onUpdateItem("items", i, "title_he", e.target.value)} dir="rtl" /></FormField>
          <FormField label="الوصف (عربي)"><input className="input" value={item.desc_ar || ""} onChange={(e) => onUpdateItem("items", i, "desc_ar", e.target.value)} /></FormField>
          <FormField label="התיאור (עברית)"><input className="input" value={item.desc_he || ""} onChange={(e) => onUpdateItem("items", i, "desc_he", e.target.value)} dir="rtl" /></FormField>
        </div>
      ))}
    </div>
  );
}

function FAQEditor({ content, onUpdateItem, onAdd, onRemove }: { content: Record<string, any>; onUpdateItem: (key: string, i: number, f: string, v: string) => void; onAdd: (key: string, tmpl: Record<string, string>) => void; onRemove: (key: string, i: number) => void }) {
  const items = content.items || [];
  return (
    <div className="space-y-2 bg-surface-elevated/50 p-3 rounded-xl border border-surface-border">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onAdd("items", { q_ar: "", q_he: "", a_ar: "", a_he: "" })}
          className="text-xs text-brand cursor-pointer bg-transparent border-0">+ إضافة</button>
        <div className="text-xs font-bold text-brand">❓ أسئلة شائعة</div>
      </div>
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-surface-bg p-2 rounded-lg border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between">
            <button onClick={() => onRemove("items", i)} className="text-[10px] text-state-error cursor-pointer bg-transparent border-0">✕</button>
            <span className="text-[11px] text-muted">سؤال #{i + 1}</span>
          </div>
          <FormField label="السؤال (عربي)"><input className="input" value={item.q_ar || ""} onChange={(e) => onUpdateItem("items", i, "q_ar", e.target.value)} /></FormField>
          <FormField label="השאלה (עברית)"><input className="input" value={item.q_he || ""} onChange={(e) => onUpdateItem("items", i, "q_he", e.target.value)} dir="rtl" /></FormField>
          <FormField label="الإجابة (عربي)"><textarea className="input" rows={2} value={item.a_ar || ""} onChange={(e) => onUpdateItem("items", i, "a_ar", e.target.value)} /></FormField>
          <FormField label="התשובה (עברית)"><textarea className="input" rows={2} value={item.a_he || ""} onChange={(e) => onUpdateItem("items", i, "a_he", e.target.value)} dir="rtl" /></FormField>
        </div>
      ))}
    </div>
  );
}

function CTAEditor({ content, onChange }: { content: Record<string, any>; onChange: (key: string, val: any) => void }) {
  return (
    <div className="space-y-2 bg-surface-elevated/50 p-3 rounded-xl border border-surface-border">
      <div className="text-xs font-bold text-brand mb-2">📣 الدعوة للعمل</div>
      <FormField label="العنوان (عربي)"><input className="input" value={content.title_ar || ""} onChange={(e) => onChange("title_ar", e.target.value)} /></FormField>
      <FormField label="הכותרת (עברית)"><input className="input" value={content.title_he || ""} onChange={(e) => onChange("title_he", e.target.value)} dir="rtl" /></FormField>
      <FormField label="الوصف (عربي)"><textarea className="input" rows={2} value={content.desc_ar || ""} onChange={(e) => onChange("desc_ar", e.target.value)} /></FormField>
      <FormField label="התיאור (עברית)"><textarea className="input" rows={2} value={content.desc_he || ""} onChange={(e) => onChange("desc_he", e.target.value)} dir="rtl" /></FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="زر 1 (عربي)"><input className="input" value={content.btn1_ar || ""} onChange={(e) => onChange("btn1_ar", e.target.value)} /></FormField>
        <FormField label="رابط زر 1"><input className="input" value={content.btn1_link || ""} onChange={(e) => onChange("btn1_link", e.target.value)} dir="ltr" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="زر 2 (عربي)"><input className="input" value={content.btn2_ar || ""} onChange={(e) => onChange("btn2_ar", e.target.value)} /></FormField>
        <FormField label="رابط زر 2"><input className="input" value={content.btn2_link || ""} onChange={(e) => onChange("btn2_link", e.target.value)} dir="ltr" /></FormField>
      </div>
    </div>
  );
}

function FooterEditor({ content, onChange }: { content: Record<string, any>; onChange: (key: string, val: any) => void }) {
  const social = content.social || {};
  const updateSocial = (key: string, val: string) => {
    onChange("social", { ...social, [key]: val });
  };

  return (
    <div className="space-y-2 bg-surface-elevated/50 p-3 rounded-xl border border-surface-border">
      <div className="text-xs font-bold text-brand mb-2">📋 الفوتر</div>
      <FormField label="الهاتف"><input className="input" value={content.phone || ""} onChange={(e) => onChange("phone", e.target.value)} dir="ltr" /></FormField>
      <FormField label="واتساب (رقم دولي)"><input className="input" value={content.whatsapp || ""} onChange={(e) => onChange("whatsapp", e.target.value)} dir="ltr" /></FormField>
      <FormField label="البريد الإلكتروني"><input className="input" value={content.email || ""} onChange={(e) => onChange("email", e.target.value)} dir="ltr" /></FormField>
      <FormField label="العنوان (عربي)"><input className="input" value={content.address_ar || ""} onChange={(e) => onChange("address_ar", e.target.value)} /></FormField>
      <FormField label="הכתובת (עברית)"><input className="input" value={content.address_he || ""} onChange={(e) => onChange("address_he", e.target.value)} dir="rtl" /></FormField>
      <FormField label="حقوق النسخ (عربي)"><input className="input" value={content.copyright_ar || ""} onChange={(e) => onChange("copyright_ar", e.target.value)} /></FormField>
      <FormField label="זכויות יוצרים (עברית)"><input className="input" value={content.copyright_he || ""} onChange={(e) => onChange("copyright_he", e.target.value)} dir="rtl" /></FormField>
      <div className="mt-2">
        <div className="text-[11px] text-muted mb-1.5">🔗 روابط التواصل الاجتماعي</div>
        <div className="grid grid-cols-2 gap-1.5">
          <FormField label="Facebook"><input className="input" value={social.facebook || ""} onChange={(e) => updateSocial("facebook", e.target.value)} dir="ltr" /></FormField>
          <FormField label="Instagram"><input className="input" value={social.instagram || ""} onChange={(e) => updateSocial("instagram", e.target.value)} dir="ltr" /></FormField>
          <FormField label="TikTok"><input className="input" value={social.tiktok || ""} onChange={(e) => updateSocial("tiktok", e.target.value)} dir="ltr" /></FormField>
          <FormField label="Twitter"><input className="input" value={social.twitter || ""} onChange={(e) => updateSocial("twitter", e.target.value)} dir="ltr" /></FormField>
        </div>
      </div>
    </div>
  );
}
