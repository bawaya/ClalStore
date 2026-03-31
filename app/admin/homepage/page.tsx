"use client";

export const dynamic = 'force-dynamic';

// =====================================================
// ClalMobile — Admin Homepage Manager (Enhanced)
// Complete control over every section of the homepage
// + Sub-pages management + Header/Footer full control
// + ImageUpload for all image fields
// =====================================================

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { WebsiteContent, Hero, SubPage } from "@/types/database";
import { csrfHeaders } from "@/lib/csrf-client";
import { SectionList } from "./SectionList";

export default function HomepageAdminPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();

  // Website content (CMS sections)
  const [sections, setSections] = useState<WebsiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("hero");

  // Heroes (Banners)
  const { data: heroes, loading: heroesLoading, create: createHero, update: updateHero, remove: removeHero } = useAdminApi<Hero>({ endpoint: "/api/admin/heroes" });
  const [heroModal, setHeroModal] = useState(false);
  const [heroForm, setHeroForm] = useState<Partial<Hero>>({});
  const [heroEditId, setHeroEditId] = useState<string | null>(null);
  const [heroConfirm, setHeroConfirm] = useState<string | null>(null);

  // Sub Pages
  const { data: subPages, loading: subPagesLoading, create: createSubPage, update: updateSubPage, remove: removeSubPage } = useAdminApi<SubPage>({ endpoint: "/api/admin/sub-pages" });
  const [subPageModal, setSubPageModal] = useState(false);
  const [subPageForm, setSubPageForm] = useState<Partial<SubPage>>({});
  const [subPageEditId, setSubPageEditId] = useState<string | null>(null);
  const [subPageConfirm, setSubPageConfirm] = useState<string | null>(null);

  // ---- Fetch website content ----
  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSections(json.data || []);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  // ---- Get section data ----
  const getSection = (key: string): WebsiteContent | undefined => sections.find((s) => s.section === key);

  // ---- Save section ----
  const saveSection = async (sectionKey: string, updates: Partial<WebsiteContent>) => {
    const section = getSection(sectionKey);
    setSaving(sectionKey);
    try {
      const body = section
        ? { id: section.id, ...updates }
        : { section: sectionKey, ...updates };
      const res = await fetch("/api/admin/website", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      show("✅ تم الحفظ بنجاح");
      await fetchSections();
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    } finally {
      setSaving(null);
    }
  };

  // ---- Toggle visibility ----
  const toggleVisibility = async (sectionKey: string) => {
    const section = getSection(sectionKey);
    if (!section) return;
    await saveSection(sectionKey, { is_visible: !section.is_visible });
  };

  // ---- Heroes CRUD ----
  const openHeroCreate = () => {
    setHeroForm({ title_ar: "", title_he: "", subtitle_ar: "", subtitle_he: "", image_url: "", link_url: "", cta_text_ar: "تسوّق الآن", cta_text_he: "קנה עכשיו", sort_order: 0, active: true });
    setHeroEditId(null);
    setHeroModal(true);
  };

  const openHeroEdit = (h: Hero) => { setHeroForm({ ...h }); setHeroEditId(h.id); setHeroModal(true); };

  const handleHeroSave = async () => {
    if (!heroForm.title_ar) { show("❌ العنوان مطلوب", "error"); return; }
    try {
      if (heroEditId) { await updateHero(heroEditId, heroForm); show("✅ تم التعديل"); }
      else { await createHero(heroForm); show("✅ تم الإضافة"); }
      setHeroModal(false);
    } catch (err: unknown) { show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error"); }
  };

  const handleHeroDelete = async () => {
    if (heroConfirm) { await removeHero(heroConfirm); show("🗑️ تم الحذف"); setHeroConfirm(null); }
  };

  // ---- Sub Pages CRUD ----
  const openSubPageCreate = () => {
    setSubPageForm({ slug: "", title_ar: "", title_he: "", content_ar: "", content_he: "", image_url: "", is_visible: true, sort_order: 0 });
    setSubPageEditId(null);
    setSubPageModal(true);
  };

  const openSubPageEdit = (p: SubPage) => { setSubPageForm({ ...p }); setSubPageEditId(p.id); setSubPageModal(true); };

  const handleSubPageSave = async () => {
    if (!subPageForm.slug || !subPageForm.title_ar) { show("❌ الاسم المختصر والعنوان مطلوبان", "error"); return; }
    try {
      if (subPageEditId) { await updateSubPage(subPageEditId, subPageForm); show("✅ تم التعديل"); }
      else { await createSubPage(subPageForm); show("✅ تم الإضافة"); }
      setSubPageModal(false);
    } catch (err: unknown) { show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error"); }
  };

  const handleSubPageDelete = async () => {
    if (subPageConfirm) { await removeSubPage(subPageConfirm); show("🗑️ تم الحذف"); setSubPageConfirm(null); }
  };

  // ---- Expand/Collapse ----
  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="🏠 الصفحة الرئيسية" count={sections.length} />

      <p className="text-muted text-right mb-4" style={{ fontSize: scr.mobile ? 11 : 13 }}>
        تحكم كامل بكل أقسام الصفحة الرئيسية — اضغط على أي قسم لتعديله
      </p>

      <SectionList
        sections={sections}
        expanded={expanded}
        saving={saving}
        scr={scr}
        getSection={getSection}
        toggle={toggle}
        toggleVisibility={toggleVisibility}
        saveSection={saveSection}
        heroes={heroes}
        heroesLoading={heroesLoading}
        onHeroAdd={openHeroCreate}
        onHeroEdit={openHeroEdit}
        onHeroToggle={async (id, v) => { await updateHero(id, { active: v }); show(v ? "✅" : "⏸️"); }}
        onHeroDelete={(id) => setHeroConfirm(id)}
        subPages={subPages}
        subPagesLoading={subPagesLoading}
        onSubPageAdd={openSubPageCreate}
        onSubPageEdit={openSubPageEdit}
        onSubPageToggle={async (id, v) => { await updateSubPage(id, { is_visible: v }); show(v ? "✅ مرئي" : "⏸️ مخفي"); }}
        onSubPageDelete={(id) => setSubPageConfirm(id)}
      />

      {/* Hero/Banner Modal */}
      <Modal open={heroModal} onClose={() => setHeroModal(false)} title={heroEditId ? "✏️ تعديل بنر" : "➕ بنر جديد"}
        footer={<button onClick={handleHeroSave} className="btn-primary w-full">{heroEditId ? "💾 حفظ" : "✅ إضافة"}</button>}>
        <FormField label="العنوان (عربي)" required><input className="input" value={heroForm.title_ar || ""} onChange={(e) => setHeroForm({ ...heroForm, title_ar: e.target.value })} /></FormField>
        <FormField label="הכותרת (עברית)"><input className="input" value={heroForm.title_he || ""} onChange={(e) => setHeroForm({ ...heroForm, title_he: e.target.value })} dir="rtl" /></FormField>
        <FormField label="النص الفرعي (عربي)"><input className="input" value={heroForm.subtitle_ar || ""} onChange={(e) => setHeroForm({ ...heroForm, subtitle_ar: e.target.value })} /></FormField>
        <FormField label="הטקסט המשני (עברית)"><input className="input" value={heroForm.subtitle_he || ""} onChange={(e) => setHeroForm({ ...heroForm, subtitle_he: e.target.value })} dir="rtl" /></FormField>
        <ImageUpload
          value={heroForm.image_url || ""}
          onChange={(url) => setHeroForm({ ...heroForm, image_url: url })}
          label="صورة البنر"
          dimensions={IMAGE_DIMS.banner}
          previewHeight={140}
        />
        <FormField label="رابط الزر (عند الضغط)"><input className="input" value={heroForm.link_url || ""} onChange={(e) => setHeroForm({ ...heroForm, link_url: e.target.value })} placeholder="/store" dir="ltr" /></FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="نص الزر (عربي)"><input className="input" value={heroForm.cta_text_ar || ""} onChange={(e) => setHeroForm({ ...heroForm, cta_text_ar: e.target.value })} /></FormField>
          <FormField label="כפתור (עברית)"><input className="input" value={heroForm.cta_text_he || ""} onChange={(e) => setHeroForm({ ...heroForm, cta_text_he: e.target.value })} dir="rtl" /></FormField>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex-1"><FormField label="ترتيب"><input className="input" type="number" value={heroForm.sort_order || 0} onChange={(e) => setHeroForm({ ...heroForm, sort_order: Number(e.target.value) })} dir="ltr" /></FormField></div>
          <label className="flex items-center gap-1.5 mt-4"><Toggle value={heroForm.active !== false} onChange={(v) => setHeroForm({ ...heroForm, active: v })} /><span className="text-xs text-muted">مفعّل</span></label>
        </div>
      </Modal>

      {/* Sub Page Modal */}
      <Modal open={subPageModal} onClose={() => setSubPageModal(false)} title={subPageEditId ? "✏️ تعديل صفحة فرعية" : "➕ صفحة فرعية جديدة"}
        footer={<button onClick={handleSubPageSave} className="btn-primary w-full">{subPageEditId ? "💾 حفظ" : "✅ إضافة"}</button>}>
        <FormField label="الاسم المختصر (slug)" required>
          <input className="input text-xs" dir="ltr" value={subPageForm.slug || ""} onChange={(e) => setSubPageForm({ ...subPageForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="my-page" />
          <div className="text-[9px] text-dim mt-0.5 text-left">clalmobile.com/page/{subPageForm.slug || "slug"}</div>
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="العنوان (عربي)" required><input className="input" value={subPageForm.title_ar || ""} onChange={(e) => setSubPageForm({ ...subPageForm, title_ar: e.target.value })} /></FormField>
          <FormField label="הכותרת (עברית)"><input className="input" value={subPageForm.title_he || ""} onChange={(e) => setSubPageForm({ ...subPageForm, title_he: e.target.value })} dir="rtl" /></FormField>
        </div>
        <ImageUpload
          value={subPageForm.image_url || ""}
          onChange={(url) => setSubPageForm({ ...subPageForm, image_url: url })}
          label="صورة الغلاف"
          dimensions={IMAGE_DIMS.subPage}
          previewHeight={140}
        />
        <FormField label="المحتوى (عربي)">
          <textarea className="input" rows={6} value={subPageForm.content_ar || ""} onChange={(e) => setSubPageForm({ ...subPageForm, content_ar: e.target.value })} placeholder="اكتب محتوى الصفحة هنا..." />
        </FormField>
        <FormField label="התוכן (עברית)">
          <textarea className="input" rows={6} value={subPageForm.content_he || ""} onChange={(e) => setSubPageForm({ ...subPageForm, content_he: e.target.value })} dir="rtl" />
        </FormField>
        <div className="flex gap-3 items-center">
          <div className="flex-1"><FormField label="ترتيب"><input className="input" type="number" value={subPageForm.sort_order || 0} onChange={(e) => setSubPageForm({ ...subPageForm, sort_order: Number(e.target.value) })} dir="ltr" /></FormField></div>
          <label className="flex items-center gap-1.5 mt-4"><Toggle value={subPageForm.is_visible !== false} onChange={(v) => setSubPageForm({ ...subPageForm, is_visible: v })} /><span className="text-xs text-muted">مرئي</span></label>
        </div>
      </Modal>

      <ConfirmDialog open={!!heroConfirm} onClose={() => setHeroConfirm(null)} onConfirm={handleHeroDelete} title="🗑️ حذف البنر؟" message="سيتم حذف البنر نهائياً ولا يمكن التراجع" />
      <ConfirmDialog open={!!subPageConfirm} onClose={() => setSubPageConfirm(null)} onConfirm={handleSubPageDelete} title="🗑️ حذف الصفحة؟" message="سيتم حذف الصفحة الفرعية نهائياً" />

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div key={t.id} className={`card font-bold shadow-2xl px-5 py-2.5 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
