"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/shared";
import type { EditorProps } from "./types";
import { SaveButton } from "./SaveButton";

export function FAQSectionEditor({ section, onSave, saving, scr }: EditorProps) {
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
