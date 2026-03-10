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
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState, ErrorBanner, ToastContainer } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { WebsiteContent, Hero, SubPage } from "@/types/database";

// ===== Section Meta =====
const SECTIONS: { key: string; icon: string; label: string; desc: string }[] = [
  { key: "header", icon: "📌", label: "الهيدر (شريط التنقل)", desc: "الشعار والقائمة وأزرار الهيدر العلوي" },
  { key: "hero", icon: "🏠", label: "الهيرو الرئيسي", desc: "العنوان والوصف وأزرار الصفحة الرئيسية" },
  { key: "banners", icon: "🖼️", label: "البنرات (الكاروسيل)", desc: "بنرات العروض المتحركة في صفحة المتجر" },
  { key: "stats", icon: "📊", label: "شريط الإحصائيات", desc: "الأرقام المعروضة (عملاء، منتجات، توصيل...)" },
  { key: "features", icon: "⭐", label: "المميزات", desc: "مميزات المتجر (وكيل رسمي، توصيل مجاني...)" },
  { key: "faq", icon: "❓", label: "الأسئلة الشائعة", desc: "أسئلة وأجوبة الزبائن" },
  { key: "cta", icon: "📣", label: "الدعوة للعمل (CTA)", desc: "القسم التحفيزي قبل الفوتر" },
  { key: "footer", icon: "📋", label: "الفوتر", desc: "معلومات التواصل والروابط الاجتماعية والشعار" },
  { key: "subpages", icon: "📄", label: "صفحات فرعية", desc: "إضافة وإدارة صفحات فرعية مخصصة" },
];

export default function HomepageAdminPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();

  // Website content (CMS sections)
  const [sections, setSections] = useState<WebsiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("hero");

  // Heroes (Banners)
  const { data: heroes, loading: heroesLoading, error: heroesError, clearError: clearHeroesError, create: createHero, update: updateHero, remove: removeHero } = useAdminApi<Hero>({ endpoint: "/api/admin/heroes" });
  const [heroModal, setHeroModal] = useState(false);
  const [heroForm, setHeroForm] = useState<Partial<Hero>>({});
  const [heroEditId, setHeroEditId] = useState<string | null>(null);
  const [heroConfirm, setHeroConfirm] = useState<string | null>(null);

  // Sub Pages
  const { data: subPages, loading: subPagesLoading, error: subPagesError, clearError: clearSubPagesError, create: createSubPage, update: updateSubPage, remove: removeSubPage } = useAdminApi<SubPage>({ endpoint: "/api/admin/sub-pages" });
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
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      show("✅ تم الحفظ بنجاح");
      await fetchSections();
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
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
    } catch (err: any) { show(`❌ ${err.message}`, "error"); }
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
    } catch (err: any) { show(`❌ ${err.message}`, "error"); }
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
      <ErrorBanner error={heroesError} onDismiss={clearHeroesError} />
      <ErrorBanner error={subPagesError} onDismiss={clearSubPagesError} />

      <p className="text-muted text-right mb-4" style={{ fontSize: scr.mobile ? 11 : 13 }}>
        تحكم كامل بكل أقسام الصفحة الرئيسية — اضغط على أي قسم لتعديله
      </p>

      <div className="space-y-2">
        {SECTIONS.map(({ key, icon, label, desc }) => {
          const section = getSection(key);
          const isExpanded = expanded === key;
          const isBanners = key === "banners";
          const isSubPages = key === "subpages";
          const noToggle = isBanners || isSubPages;

          return (
            <div key={key} className="card overflow-hidden transition-all" style={{ borderColor: isExpanded ? "rgba(196,16,64,0.3)" : undefined }}>
              {/* Section Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                style={{ padding: scr.mobile ? "12px 14px" : "16px 20px" }}
                onClick={() => toggle(key)}
              >
                <div className="flex items-center gap-2">
                  {!noToggle && section && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Toggle value={section.is_visible} onChange={() => toggleVisibility(key)} />
                    </div>
                  )}
                  <span className="transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", fontSize: 14, color: "#71717a" }}>
                    ◀
                  </span>
                </div>
                <div className="flex-1 text-right mr-3">
                  <div className="font-bold" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                    {icon} {label}
                  </div>
                  <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                    {desc}
                    {!noToggle && section && (
                      <span className="mr-2">
                        {section.is_visible ? <span className="text-state-success">● مرئي</span> : <span className="text-state-error">● مخفي</span>}
                      </span>
                    )}
                    {isSubPages && <span className="mr-2 text-brand">{subPages.length} صفحات</span>}
                  </div>
                </div>
              </div>

              {/* Section Body */}
              {isExpanded && (
                <div className="border-t border-surface-border" style={{ padding: scr.mobile ? "14px" : "20px" }}>
                  {key === "header" && <HeaderSectionEditor section={section} onSave={(u) => saveSection("header", u)} saving={saving === "header"} scr={scr} />}
                  {key === "hero" && <HeroSectionEditor section={section} onSave={(u) => saveSection("hero", u)} saving={saving === "hero"} scr={scr} />}
                  {key === "banners" && <BannersSectionEditor heroes={heroes} loading={heroesLoading} onAdd={openHeroCreate} onEdit={openHeroEdit} onToggle={async (id, v) => { await updateHero(id, { active: v }); show(v ? "✅" : "⏸️"); }} onDelete={(id) => setHeroConfirm(id)} scr={scr} />}
                  {key === "stats" && <StatsSectionEditor section={section} onSave={(u) => saveSection("stats", u)} saving={saving === "stats"} scr={scr} />}
                  {key === "features" && <FeaturesSectionEditor section={section} onSave={(u) => saveSection("features", u)} saving={saving === "features"} scr={scr} />}
                  {key === "faq" && <FAQSectionEditor section={section} onSave={(u) => saveSection("faq", u)} saving={saving === "faq"} scr={scr} />}
                  {key === "cta" && <CTASectionEditor section={section} onSave={(u) => saveSection("cta", u)} saving={saving === "cta"} scr={scr} />}
                  {key === "footer" && <FooterSectionEditor section={section} onSave={(u) => saveSection("footer", u)} saving={saving === "footer"} scr={scr} />}
                  {key === "subpages" && <SubPagesSectionEditor pages={subPages} loading={subPagesLoading} onAdd={openSubPageCreate} onEdit={openSubPageEdit} onToggle={async (id, v) => { await updateSubPage(id, { is_visible: v }); show(v ? "✅ مرئي" : "⏸️ مخفي"); }} onDelete={(id) => setSubPageConfirm(id)} scr={scr} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

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

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// =====================================================
// Section Editors — Each one manages its own local state
// =====================================================

type EditorProps = {
  section?: WebsiteContent;
  onSave: (updates: Partial<WebsiteContent>) => Promise<void>;
  saving: boolean;
  scr: ReturnType<typeof useScreen>;
};

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} className="btn-primary disabled:opacity-60" style={{ fontSize: 13, padding: "10px 28px" }}>
      {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
    </button>
  );
}

// ===== 0. Header Section Editor (NEW) =====
function HeaderSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [c, setC] = useState<Record<string, any>>(section?.content || {});

  const updateC = (key: string, val: any) => setC((prev) => ({ ...prev, [key]: val }));

  const navLinks = c.nav_links || [
    { href: "/", label_ar: "الرئيسية", label_he: "ראשי" },
    { href: "/store", label_ar: "المتجر", label_he: "חנות" },
    { href: "/#plans", label_ar: "باقات", label_he: "חבילות" },
    { href: "/about", label_ar: "من نحن", label_he: "אודות" },
    { href: "/faq", label_ar: "أسئلة شائعة", label_he: "שאלות" },
    { href: "/contact", label_ar: "اتصل بنا", label_he: "צור קשר" },
  ];

  const updateNavLink = (i: number, field: string, val: string) => {
    const next = [...navLinks];
    next[i] = { ...next[i], [field]: val };
    updateC("nav_links", next);
  };

  const addNavLink = () => updateC("nav_links", [...navLinks, { href: "/", label_ar: "", label_he: "" }]);
  const removeNavLink = (i: number) => { const next = [...navLinks]; next.splice(i, 1); updateC("nav_links", next); };

  const handleSave = () => onSave({ content: c });

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-brand mb-1">📌 الهيدر — شريط التنقل العلوي</div>

      {/* Logo */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🏷️ الشعار</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="اسم الموقع (عربي)"><input className="input" value={c.site_name_ar || "ClalMobile"} onChange={(e) => updateC("site_name_ar", e.target.value)} /></FormField>
          <FormField label="שם האתר (עברית)"><input className="input" value={c.site_name_he || "ClalMobile"} onChange={(e) => updateC("site_name_he", e.target.value)} dir="rtl" /></FormField>
        </div>
        <ImageUpload
          value={c.logo_url || ""}
          onChange={(url) => updateC("logo_url", url)}
          label="شعار الموقع"
          dimensions={IMAGE_DIMS.logo}
          previewHeight={80}
          rounded
        />
      </div>

      {/* CTA Button */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🔘 زر الهيدر الرئيسي</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
          <FormField label="نص الزر (عربي)"><input className="input" value={c.cta_text_ar || "تسوّق الآن"} onChange={(e) => updateC("cta_text_ar", e.target.value)} /></FormField>
          <FormField label="כפתור (עברית)"><input className="input" value={c.cta_text_he || "קנה עכשיו"} onChange={(e) => updateC("cta_text_he", e.target.value)} dir="rtl" /></FormField>
          <FormField label="رابط الزر"><input className="input" value={c.cta_link || "/store"} onChange={(e) => updateC("cta_link", e.target.value)} dir="ltr" /></FormField>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="flex items-center justify-between mb-1">
          <button onClick={addNavLink} className="text-xs text-brand bg-transparent border-0 cursor-pointer font-bold">➕ إضافة رابط</button>
          <div className="text-[11px] font-bold text-muted">🔗 روابط التنقل ({navLinks.length})</div>
        </div>

        {navLinks.map((link: any, i: number) => (
          <div key={i} className="bg-surface-bg/50 border border-surface-border rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between">
              <button onClick={() => removeNavLink(i)} className="text-[10px] text-state-error cursor-pointer bg-transparent border-0 hover:underline">✕ حذف</button>
              <span className="text-[10px] text-muted font-bold">رابط #{i + 1}</span>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
              <FormField label="الرابط"><input className="input text-xs" value={link.href || ""} onChange={(e) => updateNavLink(i, "href", e.target.value)} dir="ltr" placeholder="/" /></FormField>
              <FormField label="النص (عربي)"><input className="input text-xs" value={link.label_ar || ""} onChange={(e) => updateNavLink(i, "label_ar", e.target.value)} /></FormField>
              <FormField label="הטקסט (עברית)"><input className="input text-xs" value={link.label_he || ""} onChange={(e) => updateNavLink(i, "label_he", e.target.value)} dir="rtl" /></FormField>
            </div>
          </div>
        ))}
      </div>

      {/* Style */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🎨 التنسيق</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
          <FormField label="لون الخلفية">
            <div className="flex gap-1.5 items-center">
              <input type="color" value={c.bg_color || "#09090b"} onChange={(e) => updateC("bg_color", e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
              <input className="input text-xs flex-1" value={c.bg_color || "#09090b"} onChange={(e) => updateC("bg_color", e.target.value)} dir="ltr" />
            </div>
          </FormField>
          <FormField label="لون النص">
            <div className="flex gap-1.5 items-center">
              <input type="color" value={c.text_color || "#ffffff"} onChange={(e) => updateC("text_color", e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
              <input className="input text-xs flex-1" value={c.text_color || "#ffffff"} onChange={(e) => updateC("text_color", e.target.value)} dir="ltr" />
            </div>
          </FormField>
          <FormField label="شفافية الخلفية">
            <select className="input text-xs" value={c.blur_effect || "backdrop-blur-xl"} onChange={(e) => updateC("blur_effect", e.target.value)}>
              <option value="backdrop-blur-xl">ضبابي قوي</option>
              <option value="backdrop-blur-md">ضبابي متوسط</option>
              <option value="backdrop-blur-sm">ضبابي خفيف</option>
              <option value="">بدون ضبابية</option>
            </select>
          </FormField>
        </div>
      </div>

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 1. Hero Section Editor =====
function HeroSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [titleAr, setTitleAr] = useState(section?.title_ar || "");
  const [titleHe, setTitleHe] = useState(section?.title_he || "");
  const [c, setC] = useState<Record<string, any>>(section?.content || {});

  const updateC = (key: string, val: any) => setC((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    onSave({ title_ar: titleAr, title_he: titleHe, content: c });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-brand mb-1">🏠 القسم الرئيسي — العنوان والوصف وأزرار الصفحة</div>

      <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
        <FormField label="العنوان الرئيسي (عربي)">
          <input className="input" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="ClalMobile" />
        </FormField>
        <FormField label="הכותרת הראשית (עברית)">
          <input className="input" value={titleHe} onChange={(e) => setTitleHe(e.target.value)} dir="rtl" placeholder="ClalMobile" />
        </FormField>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
        <FormField label="🏷️ شارة (عربي)">
          <input className="input" value={c.badge_ar || ""} onChange={(e) => updateC("badge_ar", e.target.value)} placeholder="🔥 عروض حصرية" />
        </FormField>
        <FormField label="🏷️ תג (עברית)">
          <input className="input" value={c.badge_he || ""} onChange={(e) => updateC("badge_he", e.target.value)} dir="rtl" />
        </FormField>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
        <FormField label="الوصف (عربي)">
          <textarea className="input" rows={2} value={c.description_ar || ""} onChange={(e) => updateC("description_ar", e.target.value)} placeholder="أفضل الأسعار على الأجهزة الذكية والإكسسوارات" />
        </FormField>
        <FormField label="התיאור (עברית)">
          <textarea className="input" rows={2} value={c.description_he || ""} onChange={(e) => updateC("description_he", e.target.value)} dir="rtl" />
        </FormField>
      </div>

      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🔘 أزرار الهيرو</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="زر المتجر (عربي)"><input className="input" value={c.cta_store_ar || ""} onChange={(e) => updateC("cta_store_ar", e.target.value)} placeholder="تسوّق الآن" /></FormField>
          <FormField label="כפתור חנות (עברית)"><input className="input" value={c.cta_store_he || ""} onChange={(e) => updateC("cta_store_he", e.target.value)} dir="rtl" /></FormField>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="زر الباقات (عربي)"><input className="input" value={c.cta_plans_ar || ""} onChange={(e) => updateC("cta_plans_ar", e.target.value)} placeholder="باقات الخطوط" /></FormField>
          <FormField label="כפתור חבילות (עברית)"><input className="input" value={c.cta_plans_he || ""} onChange={(e) => updateC("cta_plans_he", e.target.value)} dir="rtl" /></FormField>
        </div>
      </div>

      <ImageUpload
        value={c.bg_image || ""}
        onChange={(url) => updateC("bg_image", url)}
        label="صورة خلفية الهيرو"
        dimensions={IMAGE_DIMS.heroBg}
        previewHeight={140}
      />

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 2. Banners Section Editor =====
function BannersSectionEditor({ heroes, loading, onAdd, onEdit, onToggle, onDelete, scr }: {
  heroes: Hero[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (h: Hero) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  scr: ReturnType<typeof useScreen>;
}) {
  if (loading) return <div className="text-center py-8 text-muted">⏳</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted" style={{ fontSize: 11 }}>{heroes.length} بنر</span>
        <button onClick={onAdd} className="btn-primary" style={{ fontSize: 12, padding: "8px 16px" }}>
          ➕ بنر جديد
        </button>
      </div>

      {heroes.length === 0 ? (
        <EmptyState icon="🖼️" title="لا يوجد بنرات" sub="أضف بنر أول لعرضه في الكاروسيل" />
      ) : (
        <div className="space-y-1.5">
          {heroes.map((h) => (
            <div key={h.id} className="bg-surface-elevated/50 border border-surface-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-brand/30 transition-all"
              style={{ padding: scr.mobile ? "10px 12px" : "12px 16px" }}
              onClick={() => onEdit(h)}>

              {h.image_url ? (
                <div className="w-16 h-10 bg-surface-bg rounded-lg overflow-hidden flex-shrink-0">
                  <img src={h.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-10 bg-surface-bg rounded-lg flex items-center justify-center flex-shrink-0 text-xl">🖼️</div>
              )}

              <div className="flex-1 text-right min-w-0">
                <div className="font-bold truncate" style={{ fontSize: scr.mobile ? 12 : 14 }}>{h.title_ar}</div>
                <div className="text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {h.subtitle_ar || "—"} • ترتيب: {h.sort_order}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Toggle value={h.active} onChange={(v) => onToggle(h.id, v)} />
                <button onClick={() => onDelete(h.id)}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center hover:bg-state-error/10">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 3. Stats Section Editor =====
function StatsSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [items, setItems] = useState<any[]>(section?.content?.items || []);

  const updateItem = (i: number, field: string, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  };

  const addItem = () => setItems([...items, { value: "", label_ar: "", label_he: "", icon: "📌" }]);
  const removeItem = (i: number) => { const next = [...items]; next.splice(i, 1); setItems(next); };

  const handleSave = () => onSave({ content: { ...section?.content, items } });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted" style={{ fontSize: 11 }}>{items.length} إحصائيات</span>
        <button onClick={addItem} className="text-xs text-brand bg-transparent border-0 cursor-pointer font-bold">➕ إضافة إحصاء</button>
      </div>

      {items.map((item, i) => (
        <div key={i} className="bg-surface-elevated/50 border border-surface-border rounded-xl space-y-2" style={{ padding: scr.mobile ? "12px" : "16px" }}>
          <div className="flex items-center justify-between">
            <button onClick={() => removeItem(i)} className="text-[11px] text-state-error cursor-pointer bg-transparent border-0 hover:underline">✕ حذف</button>
            <span className="text-[11px] text-muted font-bold">إحصاء #{i + 1}</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "80px 1fr 1fr 1fr" }}>
            <FormField label="أيقونة"><input className="input text-center" value={item.icon || ""} onChange={(e) => updateItem(i, "icon", e.target.value)} /></FormField>
            <FormField label="القيمة"><input className="input" value={item.value || ""} onChange={(e) => updateItem(i, "value", e.target.value)} dir="ltr" placeholder="500+" /></FormField>
            <FormField label="النص (عربي)"><input className="input" value={item.label_ar || ""} onChange={(e) => updateItem(i, "label_ar", e.target.value)} placeholder="عميل سعيد" /></FormField>
            <FormField label="הטקסט (עברית)"><input className="input" value={item.label_he || ""} onChange={(e) => updateItem(i, "label_he", e.target.value)} dir="rtl" /></FormField>
          </div>
        </div>
      ))}

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 4. Features Section Editor =====
function FeaturesSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [items, setItems] = useState<any[]>(section?.content?.items || []);

  const updateItem = (i: number, field: string, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  };

  const addItem = () => setItems([...items, { icon: "⭐", title_ar: "", title_he: "", desc_ar: "", desc_he: "" }]);
  const removeItem = (i: number) => { const next = [...items]; next.splice(i, 1); setItems(next); };
  const moveItem = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const handleSave = () => onSave({ content: { ...section?.content, items } });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted" style={{ fontSize: 11 }}>{items.length} مميزات</span>
        <button onClick={addItem} className="text-xs text-brand bg-transparent border-0 cursor-pointer font-bold">➕ إضافة ميزة</button>
      </div>

      {items.map((item, i) => (
        <div key={i} className="bg-surface-elevated/50 border border-surface-border rounded-xl space-y-2" style={{ padding: scr.mobile ? "12px" : "16px" }}>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button onClick={() => removeItem(i)} className="text-[11px] text-state-error cursor-pointer bg-transparent border-0 hover:underline">✕ حذف</button>
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-[11px] text-muted cursor-pointer bg-transparent border-0 disabled:opacity-30">▲</button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-[11px] text-muted cursor-pointer bg-transparent border-0 disabled:opacity-30">▼</button>
            </div>
            <span className="text-[11px] text-muted font-bold">ميزة #{i + 1}</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "80px 1fr 1fr" }}>
            <FormField label="أيقونة"><input className="input text-center" value={item.icon || ""} onChange={(e) => updateItem(i, "icon", e.target.value)} /></FormField>
            <FormField label="العنوان (عربي)"><input className="input" value={item.title_ar || ""} onChange={(e) => updateItem(i, "title_ar", e.target.value)} /></FormField>
            <FormField label="הכותרת (עברית)"><input className="input" value={item.title_he || ""} onChange={(e) => updateItem(i, "title_he", e.target.value)} dir="rtl" /></FormField>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
            <FormField label="الوصف (عربي)"><textarea className="input" rows={2} value={item.desc_ar || ""} onChange={(e) => updateItem(i, "desc_ar", e.target.value)} /></FormField>
            <FormField label="התיאור (עברית)"><textarea className="input" rows={2} value={item.desc_he || ""} onChange={(e) => updateItem(i, "desc_he", e.target.value)} dir="rtl" /></FormField>
          </div>
        </div>
      ))}

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 5. FAQ Section Editor =====
function FAQSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [items, setItems] = useState<any[]>(section?.content?.items || []);

  const updateItem = (i: number, field: string, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  };

  const addItem = () => setItems([...items, { q_ar: "", q_he: "", a_ar: "", a_he: "" }]);
  const removeItem = (i: number) => { const next = [...items]; next.splice(i, 1); setItems(next); };
  const moveItem = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const handleSave = () => onSave({ content: { ...section?.content, items } });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted" style={{ fontSize: 11 }}>{items.length} أسئلة</span>
        <button onClick={addItem} className="text-xs text-brand bg-transparent border-0 cursor-pointer font-bold">➕ إضافة سؤال</button>
      </div>

      {items.map((item, i) => (
        <div key={i} className="bg-surface-elevated/50 border border-surface-border rounded-xl space-y-2" style={{ padding: scr.mobile ? "12px" : "16px" }}>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button onClick={() => removeItem(i)} className="text-[11px] text-state-error cursor-pointer bg-transparent border-0 hover:underline">✕ حذف</button>
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-[11px] text-muted cursor-pointer bg-transparent border-0 disabled:opacity-30">▲</button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-[11px] text-muted cursor-pointer bg-transparent border-0 disabled:opacity-30">▼</button>
            </div>
            <span className="text-[11px] text-muted font-bold">سؤال #{i + 1}</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
            <FormField label="السؤال (عربي)"><input className="input" value={item.q_ar || ""} onChange={(e) => updateItem(i, "q_ar", e.target.value)} /></FormField>
            <FormField label="השאלה (עברית)"><input className="input" value={item.q_he || ""} onChange={(e) => updateItem(i, "q_he", e.target.value)} dir="rtl" /></FormField>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
            <FormField label="الإجابة (عربي)"><textarea className="input" rows={2} value={item.a_ar || ""} onChange={(e) => updateItem(i, "a_ar", e.target.value)} /></FormField>
            <FormField label="התשובה (עברית)"><textarea className="input" rows={2} value={item.a_he || ""} onChange={(e) => updateItem(i, "a_he", e.target.value)} dir="rtl" /></FormField>
          </div>
        </div>
      ))}

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 6. CTA Section Editor =====
function CTASectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [titleAr, setTitleAr] = useState(section?.title_ar || "");
  const [titleHe, setTitleHe] = useState(section?.title_he || "");
  const [c, setC] = useState<Record<string, any>>(section?.content || {});

  const updateC = (key: string, val: any) => setC((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => onSave({ title_ar: titleAr, title_he: titleHe, content: c });

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-brand mb-1">📣 القسم التحفيزي — يظهر قبل الفوتر</div>

      <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
        <FormField label="العنوان (عربي)"><input className="input" value={c.title_ar || ""} onChange={(e) => updateC("title_ar", e.target.value)} /></FormField>
        <FormField label="הכותרת (עברית)"><input className="input" value={c.title_he || ""} onChange={(e) => updateC("title_he", e.target.value)} dir="rtl" /></FormField>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
        <FormField label="الوصف (عربي)"><textarea className="input" rows={2} value={c.desc_ar || ""} onChange={(e) => updateC("desc_ar", e.target.value)} /></FormField>
        <FormField label="התיאור (עברית)"><textarea className="input" rows={2} value={c.desc_he || ""} onChange={(e) => updateC("desc_he", e.target.value)} dir="rtl" /></FormField>
      </div>

      <ImageUpload
        value={c.bg_image || ""}
        onChange={(url) => updateC("bg_image", url)}
        label="صورة خلفية القسم"
        dimensions={IMAGE_DIMS.heroBg}
        previewHeight={100}
      />

      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🔘 الأزرار</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
          <FormField label="زر 1 (عربي)"><input className="input" value={c.btn1_ar || ""} onChange={(e) => updateC("btn1_ar", e.target.value)} /></FormField>
          <FormField label="כפתור 1 (עברית)"><input className="input" value={c.btn1_he || ""} onChange={(e) => updateC("btn1_he", e.target.value)} dir="rtl" /></FormField>
          <FormField label="رابط زر 1"><input className="input" value={c.btn1_link || ""} onChange={(e) => updateC("btn1_link", e.target.value)} dir="ltr" placeholder="/store" /></FormField>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
          <FormField label="زر 2 (عربي)"><input className="input" value={c.btn2_ar || ""} onChange={(e) => updateC("btn2_ar", e.target.value)} /></FormField>
          <FormField label="כפתור 2 (עברית)"><input className="input" value={c.btn2_he || ""} onChange={(e) => updateC("btn2_he", e.target.value)} dir="rtl" /></FormField>
          <FormField label="رابط زر 2"><input className="input" value={c.btn2_link || ""} onChange={(e) => updateC("btn2_link", e.target.value)} dir="ltr" placeholder="/contact" /></FormField>
        </div>
      </div>

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 7. Footer Section Editor (Enhanced) =====
function FooterSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [titleAr, setTitleAr] = useState(section?.title_ar || "");
  const [titleHe, setTitleHe] = useState(section?.title_he || "");
  const [c, setC] = useState<Record<string, any>>(section?.content || {});

  const updateC = (key: string, val: any) => setC((prev) => ({ ...prev, [key]: val }));
  const social = c.social || {};
  const updateSocial = (key: string, val: string) => updateC("social", { ...social, [key]: val });

  // Footer links management
  const footerLinks = c.footer_links || [];
  const updateFooterLink = (i: number, field: string, val: string) => {
    const next = [...footerLinks];
    next[i] = { ...next[i], [field]: val };
    updateC("footer_links", next);
  };
  const addFooterLink = () => updateC("footer_links", [...footerLinks, { href: "/", label_ar: "", label_he: "" }]);
  const removeFooterLink = (i: number) => { const next = [...footerLinks]; next.splice(i, 1); updateC("footer_links", next); };

  const handleSave = () => onSave({ title_ar: titleAr, title_he: titleHe, content: c });

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-brand mb-1">📋 الفوتر — تحكم كامل بالفوتر</div>

      {/* Footer Logo */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🏷️ شعار الفوتر والوصف</div>
        <ImageUpload
          value={c.footer_logo || ""}
          onChange={(url) => updateC("footer_logo", url)}
          label="شعار الفوتر"
          dimensions={IMAGE_DIMS.logo}
          previewHeight={60}
          rounded
        />
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="وصف الفوتر (عربي)"><textarea className="input" rows={2} value={c.footer_desc_ar || ""} onChange={(e) => updateC("footer_desc_ar", e.target.value)} placeholder="الوكيل الرسمي للأجهزة الذكية" /></FormField>
          <FormField label="תיאור הפוטר (עברית)"><textarea className="input" rows={2} value={c.footer_desc_he || ""} onChange={(e) => updateC("footer_desc_he", e.target.value)} dir="rtl" /></FormField>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">📞 معلومات التواصل</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
          <FormField label="📞 الهاتف"><input className="input" value={c.phone || ""} onChange={(e) => updateC("phone", e.target.value)} dir="ltr" placeholder="053-3337653" /></FormField>
          <FormField label="💬 واتساب"><input className="input" value={c.whatsapp || ""} onChange={(e) => updateC("whatsapp", e.target.value)} dir="ltr" placeholder="972533337653" /></FormField>
          <FormField label="📧 البريد"><input className="input" value={c.email || ""} onChange={(e) => updateC("email", e.target.value)} dir="ltr" placeholder="info@clalmobile.com" /></FormField>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="العنوان (عربي)"><input className="input" value={c.address_ar || ""} onChange={(e) => updateC("address_ar", e.target.value)} placeholder="إسرائيل — المثلث" /></FormField>
          <FormField label="הכתובת (עברית)"><input className="input" value={c.address_he || ""} onChange={(e) => updateC("address_he", e.target.value)} dir="rtl" /></FormField>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="ساعات العمل (عربي)"><input className="input" value={c.hours_ar || ""} onChange={(e) => updateC("hours_ar", e.target.value)} placeholder="الأحد-الخميس 9:00-18:00" /></FormField>
          <FormField label="שעות פעילות (עברית)"><input className="input" value={c.hours_he || ""} onChange={(e) => updateC("hours_he", e.target.value)} dir="rtl" /></FormField>
        </div>
      </div>

      {/* Copyright */}
      <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
        <FormField label="حقوق النسخ (عربي)"><input className="input" value={c.copyright_ar || ""} onChange={(e) => updateC("copyright_ar", e.target.value)} placeholder="© 2026 ClalMobile" /></FormField>
        <FormField label="זכויות יוצרים (עברית)"><input className="input" value={c.copyright_he || ""} onChange={(e) => updateC("copyright_he", e.target.value)} dir="rtl" /></FormField>
      </div>

      {/* Custom Footer Links */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="flex items-center justify-between mb-1">
          <button onClick={addFooterLink} className="text-xs text-brand bg-transparent border-0 cursor-pointer font-bold">➕ إضافة رابط</button>
          <div className="text-[11px] font-bold text-muted">🔗 روابط الفوتر الإضافية ({footerLinks.length})</div>
        </div>
        {footerLinks.map((link: any, i: number) => (
          <div key={i} className="bg-surface-bg/50 border border-surface-border rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between">
              <button onClick={() => removeFooterLink(i)} className="text-[10px] text-state-error cursor-pointer bg-transparent border-0 hover:underline">✕ حذف</button>
              <span className="text-[10px] text-muted font-bold">رابط #{i + 1}</span>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
              <FormField label="الرابط"><input className="input text-xs" value={link.href || ""} onChange={(e) => updateFooterLink(i, "href", e.target.value)} dir="ltr" /></FormField>
              <FormField label="النص (عربي)"><input className="input text-xs" value={link.label_ar || ""} onChange={(e) => updateFooterLink(i, "label_ar", e.target.value)} /></FormField>
              <FormField label="הטקסט (עברית)"><input className="input text-xs" value={link.label_he || ""} onChange={(e) => updateFooterLink(i, "label_he", e.target.value)} dir="rtl" /></FormField>
            </div>
          </div>
        ))}
      </div>

      {/* Social Media */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🔗 روابط التواصل الاجتماعي</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          <FormField label="📘 Facebook"><input className="input" value={social.facebook || ""} onChange={(e) => updateSocial("facebook", e.target.value)} dir="ltr" placeholder="https://facebook.com/..." /></FormField>
          <FormField label="📸 Instagram"><input className="input" value={social.instagram || ""} onChange={(e) => updateSocial("instagram", e.target.value)} dir="ltr" placeholder="https://instagram.com/..." /></FormField>
          <FormField label="🎵 TikTok"><input className="input" value={social.tiktok || ""} onChange={(e) => updateSocial("tiktok", e.target.value)} dir="ltr" placeholder="https://tiktok.com/@..." /></FormField>
          <FormField label="🐦 Twitter/X"><input className="input" value={social.twitter || ""} onChange={(e) => updateSocial("twitter", e.target.value)} dir="ltr" placeholder="https://x.com/..." /></FormField>
          <FormField label="📺 YouTube"><input className="input" value={social.youtube || ""} onChange={(e) => updateSocial("youtube", e.target.value)} dir="ltr" placeholder="https://youtube.com/..." /></FormField>
          <FormField label="💼 LinkedIn"><input className="input" value={social.linkedin || ""} onChange={(e) => updateSocial("linkedin", e.target.value)} dir="ltr" placeholder="https://linkedin.com/..." /></FormField>
        </div>
      </div>

      {/* Style */}
      <div className="bg-surface-elevated/50 p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-muted mb-1">🎨 تنسيق الفوتر</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
          <FormField label="لون الخلفية">
            <div className="flex gap-1.5 items-center">
              <input type="color" value={c.footer_bg || "#111114"} onChange={(e) => updateC("footer_bg", e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
              <input className="input text-xs flex-1" value={c.footer_bg || "#111114"} onChange={(e) => updateC("footer_bg", e.target.value)} dir="ltr" />
            </div>
          </FormField>
          <FormField label="لون النص">
            <div className="flex gap-1.5 items-center">
              <input type="color" value={c.footer_text || "#a1a1aa"} onChange={(e) => updateC("footer_text", e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
              <input className="input text-xs flex-1" value={c.footer_text || "#a1a1aa"} onChange={(e) => updateC("footer_text", e.target.value)} dir="ltr" />
            </div>
          </FormField>
          <FormField label="عدد أعمدة الروابط">
            <select className="input text-xs" value={c.footer_columns || "4"} onChange={(e) => updateC("footer_columns", e.target.value)}>
              <option value="2">2 أعمدة</option>
              <option value="3">3 أعمدة</option>
              <option value="4">4 أعمدة</option>
            </select>
          </FormField>
        </div>
      </div>

      <div className="flex justify-start pt-2"><SaveButton saving={saving} onClick={handleSave} /></div>
    </div>
  );
}

// ===== 8. Sub Pages Section Editor (NEW) =====
function SubPagesSectionEditor({ pages, loading, onAdd, onEdit, onToggle, onDelete, scr }: {
  pages: SubPage[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (p: SubPage) => void;
  onToggle: (id: string, visible: boolean) => void;
  onDelete: (id: string) => void;
  scr: ReturnType<typeof useScreen>;
}) {
  if (loading) return <div className="text-center py-8 text-muted">⏳</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted" style={{ fontSize: 11 }}>{pages.length} صفحات فرعية</span>
        <button onClick={onAdd} className="btn-primary" style={{ fontSize: 12, padding: "8px 16px" }}>
          ➕ صفحة جديدة
        </button>
      </div>

      {pages.length === 0 ? (
        <EmptyState icon="📄" title="لا يوجد صفحات فرعية" sub="أنشئ صفحة فرعية لعرض محتوى إضافي في الموقع" />
      ) : (
        <div className="space-y-1.5">
          {pages.map((p) => (
            <div key={p.id} className="bg-surface-elevated/50 border border-surface-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-brand/30 transition-all"
              style={{ padding: scr.mobile ? "10px 12px" : "12px 16px" }}
              onClick={() => onEdit(p)}>

              {p.image_url ? (
                <div className="w-14 h-10 bg-surface-bg rounded-lg overflow-hidden flex-shrink-0">
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-10 bg-surface-bg rounded-lg flex items-center justify-center flex-shrink-0 text-lg">📄</div>
              )}

              <div className="flex-1 text-right min-w-0">
                <div className="font-bold truncate" style={{ fontSize: scr.mobile ? 12 : 14 }}>{p.title_ar}</div>
                <div className="text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  /{p.slug} • ترتيب: {p.sort_order}
                  {p.is_visible ? <span className="text-state-success mr-1">● مرئي</span> : <span className="text-state-error mr-1">● مخفي</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Toggle value={p.is_visible} onChange={(v) => onToggle(p.id, v)} />
                <button onClick={() => onDelete(p.id)}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center hover:bg-state-error/10">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
