"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { EditorProps } from "./types";
import { SaveButton } from "./SaveButton";

export function FooterSectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [titleAr, _setTitleAr] = useState(section?.title_ar || "");
  const [titleHe, _setTitleHe] = useState(section?.title_he || "");
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
