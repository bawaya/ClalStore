"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader } from "@/components/admin/shared";

const CRITERIA = [
  { value: "price", label: "💰 السعر" },
  { value: "brand", label: "🏭 الشركة المصنعة" },
  { value: "has_image", label: "📷 وجود صورة" },
] as const;

type CriterionValue = (typeof CRITERIA)[number]["value"];
type Direction = "asc" | "desc";
type SortRule = { field: CriterionValue; direction: Direction };

const DEFAULT_RULES: SortRule[] = [
  { field: "has_image", direction: "desc" },
  { field: "brand", direction: "asc" },
  { field: "price", direction: "desc" },
];

const DIR_LABELS: Record<CriterionValue, Record<Direction, string>> = {
  price: { asc: "الأرخص أولاً", desc: "الأغلى أولاً" },
  brand: { asc: "Apple → Samsung → أخرى", desc: "أخرى → Samsung → Apple" },
  has_image: { asc: "بدون صورة أولاً", desc: "بصورة أولاً" },
};

export default function OrderPage() {
  const scr = useScreen();
  const { show } = useToast();
  const [rules, setRules] = useState<SortRule[]>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/order");
        const json = await res.json();
        if (json.sortRules?.length === 3) setRules(json.sortRules);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortRules: rules }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      show("✅ تم حفظ ترتيب الأولوية — سيؤثر على المتجر والصفحة الرئيسية");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ"}`, "error");
    } finally {
      setSaving(false);
    }
  }, [rules, show]);

  const swapRules = (i: number, j: number) => {
    if (j < 0 || j >= 3) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    setRules(next);
  };

  const changeField = (i: number, newField: CriterionValue) => {
    const otherIdx = rules.findIndex((r, idx) => idx !== i && r.field === newField);
    const next = [...rules];
    if (otherIdx !== -1) next[otherIdx] = { ...next[otherIdx], field: rules[i].field };
    next[i] = { ...next[i], field: newField };
    setRules(next);
  };

  const toggleDirection = (i: number) => {
    const next = [...rules];
    next[i] = { ...next[i], direction: next[i].direction === "asc" ? "desc" : "asc" };
    setRules(next);
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="📌 ترتيب أولوية المنتجات" />
      <p className="text-muted text-sm mb-6">
        اختر ترتيب معايير عرض الأجهزة في المتجر والصفحة الرئيسية. المعيار الأول هو الأهم.
      </p>

      <div className="grid gap-4" style={{ maxWidth: 560 }}>
        {rules.map((rule, i) => (
          <div
            key={i}
            className="card p-4 border-2"
            style={{
              borderColor: i === 0 ? "#f59e0b60" : i === 1 ? "#3b82f660" : "#71717a40",
              background: i === 0 ? "rgba(245,158,11,0.05)" : undefined,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                background: i === 0 ? "#f59e0b30" : i === 1 ? "#3b82f630" : "#71717a30",
                color: i === 0 ? "#f59e0b" : i === 1 ? "#60a5fa" : "#a1a1aa",
              }}>
                الأولوية {i + 1}
              </span>

              <div className="flex gap-1 mr-auto">
                <button
                  onClick={() => swapRules(i, i - 1)}
                  disabled={i === 0}
                  className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center text-sm disabled:opacity-20 hover:bg-surface-elevated transition-colors"
                >▲</button>
                <button
                  onClick={() => swapRules(i, i + 1)}
                  disabled={i === 2}
                  className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center text-sm disabled:opacity-20 hover:bg-surface-elevated transition-colors"
                >▼</button>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={rule.field}
                onChange={(e) => changeField(i, e.target.value as CriterionValue)}
                className="flex-1 min-w-[140px] rounded-xl border border-surface-border bg-surface-elevated text-white px-3 py-2 outline-none"
                style={{ fontSize: scr.mobile ? 13 : 14 }}
              >
                {CRITERIA.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>

              <button
                onClick={() => toggleDirection(i)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border hover:bg-surface-elevated transition-colors"
                style={{ fontSize: scr.mobile ? 11 : 12 }}
              >
                <span className="text-base">{rule.direction === "asc" ? "⬆️" : "⬇️"}</span>
                <span className="text-muted">{DIR_LABELS[rule.field][rule.direction]}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-surface-elevated border border-surface-border" style={{ maxWidth: 560 }}>
        <div className="text-xs font-bold text-muted mb-2">📋 معاينة الترتيب:</div>
        <div className="text-sm">
          {rules.map((r, i) => {
            const c = CRITERIA.find((cr) => cr.value === r.field);
            return (
              <div key={i} className="flex gap-2 items-center py-1">
                <span className="text-muted text-xs w-4">{i + 1}.</span>
                <span>{c?.label}</span>
                <span className="text-muted">→</span>
                <span className="text-brand">{DIR_LABELS[r.field][r.direction]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "💾 حفظ الترتيب"}
        </button>
      </div>
    </div>
  );
}
