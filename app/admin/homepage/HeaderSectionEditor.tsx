"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { EditorProps } from "./types";
import { SaveButton } from "./SaveButton";

export function HeaderSectionEditor({ section, onSave, saving, scr }: EditorProps) {
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
