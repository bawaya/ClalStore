// =====================================================
// ClalMobile — Template Selector Popup
// =====================================================

"use client";

import { useState, useEffect } from "react";
import type { InboxTemplate, TemplateCategory } from "@/lib/crm/inbox-types";
import { TEMPLATE_CATEGORIES } from "@/lib/crm/inbox-types";

interface Props {
  templates: InboxTemplate[];
  onSelect: (template: InboxTemplate, variables: Record<string, string>) => void;
  onClose: () => void;
}

export function TemplateSelector({ templates, onSelect, onClose }: Props) {
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<InboxTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const filtered = category === "all"
    ? templates
    : templates.filter((t) => t.category === category);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTemplate) {
          setSelectedTemplate(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, selectedTemplate]);

  /* Variable fill view */
  if (selectedTemplate) {
    const vars = selectedTemplate.variables || [];
    const preview = vars.reduce((text, v) => {
      return text.replace(`{{${v}}}`, variables[v] || `[${v}]`);
    }, selectedTemplate.content);

    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-card border border-surface-border rounded-xl shadow-xl z-30 max-h-80 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-surface-border">
          <button
            onClick={() => setSelectedTemplate(null)}
            className="text-muted hover:text-white text-sm"
          >
            → رجوع
          </button>
          <h3 className="text-sm font-bold text-white">{selectedTemplate.name}</h3>
        </div>

        {/* Variables form */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {vars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted">املأ المتغيرات:</p>
              {vars.map((v) => (
                <div key={v}>
                  <label className="text-xs text-muted mb-1 block">{v}</label>
                  <input
                    type="text"
                    value={variables[v] || ""}
                    onChange={(e) =>
                      setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                    }
                    className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#c41040]"
                    placeholder={v}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div>
            <p className="text-xs text-muted mb-1">معاينة:</p>
            <div className="bg-surface-bg border border-surface-border rounded-lg p-3 text-sm text-white/80 whitespace-pre-wrap">
              {preview}
            </div>
          </div>
        </div>

        {/* Send */}
        <div className="p-3 border-t border-surface-border">
          <button
            onClick={() => onSelect(selectedTemplate, variables)}
            className="w-full bg-[#c41040] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#a30d35] transition-colors"
          >
            إرسال القالب
          </button>
        </div>
      </div>
    );
  }

  /* Template list view */
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-card border border-surface-border rounded-xl shadow-xl z-30 max-h-72 flex flex-col">
      {/* Category tabs */}
      <div className="flex gap-1 p-2 border-b border-surface-border overflow-x-auto">
        <button
          onClick={() => setCategory("all")}
          className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
            category === "all" ? "bg-[#c41040] text-white" : "text-muted hover:bg-surface-elevated"
          }`}
        >
          الكل
        </button>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
              category === cat.value ? "bg-[#c41040] text-white" : "text-muted hover:bg-surface-elevated"
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-muted text-sm">لا توجد قوالب</div>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTemplate(t);
                setVariables({});
              }}
              className="w-full text-right px-3 py-2 hover:bg-surface-elevated transition-colors border-b border-surface-border/50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-medium">{t.name}</span>
                <span className="text-[10px] text-muted bg-surface-bg px-1.5 py-0.5 rounded">
                  {t.category}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{t.content}</p>
            </button>
          ))
        )}
      </div>

      {/* Close */}
      <div className="p-2 border-t border-surface-border text-center">
        <button onClick={onClose} className="text-xs text-muted hover:text-white">
          إغلاق
        </button>
      </div>
    </div>
  );
}
