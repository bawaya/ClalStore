"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader } from "@/components/admin/shared";

type SortConfig = {
  rules: { field: string; direction: "asc" | "desc"; enabled: boolean }[];
  brandOrder: string[];
};

const DEFAULT_CONFIG: SortConfig = {
  rules: [
    { field: "brand", direction: "asc", enabled: true },
    { field: "price", direction: "desc", enabled: true },
    { field: "has_image", direction: "desc", enabled: true },
  ],
  brandOrder: [],
};

export default function OrderPage() {
  const scr = useScreen();
  const { show } = useToast();
  const [config, setConfig] = useState<SortConfig>(DEFAULT_CONFIG);
  const [_allBrands, setAllBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/order");
        const json = await res.json();
        if (json.allBrands) setAllBrands(json.allBrands);
        if (json.config?.rules?.length === 3) {
          setConfig({
            rules: json.config.rules,
            brandOrder: json.config.brandOrder?.length
              ? json.config.brandOrder
              : json.allBrands || [],
          });
        } else if (json.allBrands) {
          setConfig((c) => ({ ...c, brandOrder: json.allBrands }));
        }
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
        body: JSON.stringify({ config }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      show("✅ تم حفظ ترتيب الأولوية");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ"}`, "error");
    } finally {
      setSaving(false);
    }
  }, [config, show]);

  const swapRules = (i: number, j: number) => {
    if (j < 0 || j >= 3) return;
    const next = [...config.rules];
    [next[i], next[j]] = [next[j], next[i]];
    setConfig((c) => ({ ...c, rules: next }));
  };

  const toggleDirection = (i: number) => {
    const next = [...config.rules];
    next[i] = { ...next[i], direction: next[i].direction === "asc" ? "desc" : "asc" };
    setConfig((c) => ({ ...c, rules: next }));
  };

  const toggleEnabled = (i: number) => {
    const next = [...config.rules];
    next[i] = { ...next[i], enabled: !next[i].enabled };
    setConfig((c) => ({ ...c, rules: next }));
  };

  const moveBrand = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= config.brandOrder.length) return;
    const next = [...config.brandOrder];
    [next[idx], next[j]] = [next[j], next[idx]];
    setConfig((c) => ({ ...c, brandOrder: next }));
  };

  const FIELD_LABELS: Record<string, string> = {
    brand: "🏭 الشركة المصنعة",
    price: "💰 السعر",
    has_image: "📷 وجود صورة",
  };

  const DIR_LABELS: Record<string, Record<string, string>> = {
    price: { asc: "الأرخص أولاً", desc: "الأغلى أولاً" },
    brand: { asc: "حسب الترتيب أدناه", desc: "عكس الترتيب أدناه" },
    has_image: { asc: "بدون صورة أولاً", desc: "بصورة أولاً" },
  };

  const PRIORITY_COLORS = ["#f59e0b", "#3b82f6", "#71717a"];

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  const brandRuleActive = config.rules.some((r) => r.field === "brand" && r.enabled);

  return (
    <div>
      <PageHeader title="📌 ترتيب أولوية المنتجات" />
      <p className="text-muted text-sm mb-6">
        حدد ترتيب معايير عرض الأجهزة في المتجر والصفحة الرئيسية. غيّر الأولوية بالأسهم.
      </p>

      {/* === Sort Rules === */}
      <div className="grid gap-3" style={{ maxWidth: 580 }}>
        {config.rules.map((rule, i) => (
          <div
            key={i}
            className="card border-2"
            style={{
              padding: scr.mobile ? 12 : 16,
              borderColor: rule.enabled ? PRIORITY_COLORS[i] + "60" : "#71717a20",
              opacity: rule.enabled ? 1 : 0.5,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: PRIORITY_COLORS[i] + "30", color: PRIORITY_COLORS[i] }}
              >
                الأولوية {i + 1}
              </span>
              <span className="font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>
                {FIELD_LABELS[rule.field]}
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

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Direction */}
              <button
                onClick={() => toggleDirection(i)}
                disabled={!rule.enabled}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border hover:bg-surface-elevated transition-colors disabled:opacity-40"
                style={{ fontSize: scr.mobile ? 11 : 12 }}
              >
                <span>{rule.direction === "asc" ? "⬆️" : "⬇️"}</span>
                <span className="text-muted">{DIR_LABELS[rule.field]?.[rule.direction]}</span>
              </button>

              {/* Enable/Disable (only for has_image) */}
              {rule.field === "has_image" && (
                <button
                  onClick={() => toggleEnabled(i)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors"
                  style={{
                    fontSize: scr.mobile ? 11 : 12,
                    borderColor: rule.enabled ? "#22c55e40" : "#ef444440",
                    background: rule.enabled ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  }}
                >
                  <span>{rule.enabled ? "✅" : "❌"}</span>
                  <span>{rule.enabled ? "مفعّل" : "معطّل"}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* === Brand Order === */}
      {brandRuleActive && (
        <div className="mt-6" style={{ maxWidth: 580 }}>
          <div className="card p-4 border border-surface-border">
            <h3 className="font-bold mb-3" style={{ fontSize: scr.mobile ? 13 : 15 }}>
              🏭 ترتيب الشركات المصنعة
            </h3>
            <p className="text-muted text-xs mb-3">حرّك الشركات لتحديد أيها تظهر أولاً في المتجر</p>
            <div className="grid gap-1.5">
              {config.brandOrder.map((brand, idx) => (
                <div
                  key={brand}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-surface-border bg-surface-elevated"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: idx < 3 ? "#f59e0b20" : "#71717a20",
                      color: idx < 3 ? "#f59e0b" : "#71717a",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-medium" style={{ fontSize: scr.mobile ? 13 : 14 }}>
                    {brand}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveBrand(idx, -1)}
                      disabled={idx === 0}
                      className="w-6 h-6 rounded border border-surface-border flex items-center justify-center text-xs disabled:opacity-20 hover:bg-surface-card transition-colors"
                    >▲</button>
                    <button
                      onClick={() => moveBrand(idx, 1)}
                      disabled={idx === config.brandOrder.length - 1}
                      className="w-6 h-6 rounded border border-surface-border flex items-center justify-center text-xs disabled:opacity-20 hover:bg-surface-card transition-colors"
                    >▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === Preview === */}
      <div className="mt-6 p-4 rounded-xl bg-surface-elevated border border-surface-border" style={{ maxWidth: 580 }}>
        <div className="text-xs font-bold text-muted mb-2">📋 معاينة الترتيب:</div>
        <div className="text-sm">
          {config.rules.filter((r) => r.enabled).map((r, i) => (
            <div key={i} className="flex gap-2 items-center py-1">
              <span className="text-muted text-xs w-4">{i + 1}.</span>
              <span>{FIELD_LABELS[r.field]}</span>
              <span className="text-muted">→</span>
              <span className="text-brand">{DIR_LABELS[r.field]?.[r.direction]}</span>
            </div>
          ))}
          {config.rules.some((r) => !r.enabled) && (
            <div className="text-muted text-xs mt-1 opacity-60">
              (المعايير المعطّلة لا تؤثر على الترتيب)
            </div>
          )}
        </div>
      </div>

      {/* === Save === */}
      <div className="mt-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "💾 حفظ الترتيب"}
        </button>
      </div>
    </div>
  );
}
