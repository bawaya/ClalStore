"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { EditorProps } from "./types";
import { SaveButton } from "./SaveButton";

export function HeroSectionEditor({ section, onSave, saving, scr }: EditorProps) {
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
