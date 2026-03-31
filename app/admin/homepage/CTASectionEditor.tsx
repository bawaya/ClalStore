"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { EditorProps } from "./types";
import { SaveButton } from "./SaveButton";

export function CTASectionEditor({ section, onSave, saving, scr }: EditorProps) {
  const [_titleAr, _setTitleAr] = useState(section?.title_ar || "");
  const [_titleHe, _setTitleHe] = useState(section?.title_he || "");
  const [c, setC] = useState<Record<string, any>>(section?.content || {});

  const updateC = (key: string, val: any) => setC((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => onSave({ title_ar: _titleAr, title_he: _titleHe, content: c });

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
