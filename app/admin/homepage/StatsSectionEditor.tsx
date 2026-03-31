"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/shared";
import type { EditorProps } from "./types";
import { SaveButton } from "./SaveButton";

export function StatsSectionEditor({ section, onSave, saving, scr }: EditorProps) {
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
