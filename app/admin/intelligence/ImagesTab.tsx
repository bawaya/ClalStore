"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

type Mode =
  | "find"
  | "audit"
  | "color"
  | "color_validate"
  | "specs"
  | "alt"
  | "vdup";

interface ImageCandidate {
  url: string;
  thumbnail: string;
  source: "google" | "pexels" | "bing";
  title?: string;
  domain?: string;
  width?: number;
  height?: number;
}

interface PickedSelection {
  index: number;
  score: number;
  role: "primary" | "gallery" | "color_variant" | "lifestyle" | "reject";
  color_label?: string | null;
  reason: string;
  candidate: ImageCandidate;
}

interface FindResult {
  candidates: ImageCandidate[];
  curated?: { rejected_count: number; global_notes?: string };
  picked: PickedSelection[];
  meta: { source_count: number; model_used: string; tokens: number; durationMs: number };
}

interface AuditProblem {
  product_id: string;
  field: "image_url" | "gallery" | "color";
  field_index?: number;
  url: string;
  score: number;
  issues: string[];
  reason: string;
}

interface AuditResult {
  problems: AuditProblem[];
  summary: { total_scanned: number; problem_count: number; avg_score: number };
  meta: { batches: number; total_tokens: number; durationMs: number };
}

interface ColorResult {
  hex: string;
  name_en: string;
  name_ar: string;
  name_he: string;
  confidence: number;
  notes?: string;
}

export function ImagesTab() {
  const [mode, setMode] = useState<Mode>("find");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ModeChip active={mode === "find"} onClick={() => setMode("find")}>
          🔍 ابحث وطبّق
        </ModeChip>
        <ModeChip active={mode === "audit"} onClick={() => setMode("audit")}>
          🩺 افحص الكتالوج
        </ModeChip>
        <ModeChip active={mode === "color"} onClick={() => setMode("color")}>
          🎨 اكتشف لون
        </ModeChip>
        <ModeChip
          active={mode === "color_validate"}
          onClick={() => setMode("color_validate")}
        >
          ✅ تحقّق ألوان
        </ModeChip>
        <ModeChip active={mode === "specs"} onClick={() => setMode("specs")}>
          📄 OCR مواصفات
        </ModeChip>
        <ModeChip active={mode === "alt"} onClick={() => setMode("alt")}>
          ✍️ alt-text
        </ModeChip>
        <ModeChip active={mode === "vdup"} onClick={() => setMode("vdup")}>
          🔀 تكرارات بصرية
        </ModeChip>
      </div>

      {mode === "find" && <FindSection />}
      {mode === "audit" && <AuditSection />}
      {mode === "color" && <ColorSection />}
      {mode === "color_validate" && <ColorValidateSection />}
      {mode === "specs" && <SpecsSection />}
      {mode === "alt" && <AltSection />}
      {mode === "vdup" && <VisualDuplicatesSection />}
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip whitespace-nowrap ${active ? "chip-active" : ""}`}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────
// 🔍 FIND & SAVE
// ────────────────────────────────────────────────

function FindSection() {
  const [productId, setProductId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FindResult | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [primary, setPrimary] = useState<number | null>(null);
  const [colorAssign, setColorAssign] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const run = async () => {
    if (!productId.trim() && !query.trim()) {
      setError("ألصق UUID المنتج أو اكتب استعلاماً");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setSelected(new Set());
    setPrimary(null);
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/intelligence/find-images", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          ...(productId.trim() ? { product_id: productId.trim() } : {}),
          ...(query.trim() ? { query: query.trim() } : {}),
          limit: 25,
          prefer_official: true,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const data = json.data as FindResult;
      setResult(data);
      // Pre-select AI picks
      const picks = new Set<number>();
      let primaryIdx: number | null = null;
      const colors: Record<number, string> = {};
      for (const p of data.picked) {
        picks.add(p.index);
        if (p.role === "primary" && primaryIdx === null) primaryIdx = p.index;
        if (p.role === "color_variant" && p.color_label) {
          colors[p.index] = p.color_label;
        }
      }
      setSelected(picks);
      setPrimary(primaryIdx);
      setColorAssign(colors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل البحث");
    }
    setLoading(false);
  };

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        if (primary === idx) setPrimary(null);
        setColorAssign((c) => {
          const copy = { ...c };
          delete copy[idx];
          return copy;
        });
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const save = async () => {
    if (!productId.trim()) {
      setError("احتاج UUID المنتج للحفظ");
      return;
    }
    if (selected.size === 0) {
      setError("اختر صورة واحدة على الأقل");
      return;
    }
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const candidates = result?.candidates || [];
      const galleryItems: { url: string }[] = [];
      const colorItems: { color_name: string; url: string }[] = [];
      let primaryItem: { url: string } | undefined;

      for (const idx of selected) {
        const c = candidates[idx];
        if (!c) continue;
        if (idx === primary) {
          primaryItem = { url: c.url };
        } else if (colorAssign[idx]) {
          colorItems.push({ color_name: colorAssign[idx], url: c.url });
        } else {
          galleryItems.push({ url: c.url });
        }
      }

      const res = await fetch("/api/admin/intelligence/save-images", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          product_id: productId.trim(),
          ...(primaryItem ? { primary: primaryItem } : {}),
          ...(galleryItems.length > 0 ? { gallery: galleryItems } : {}),
          ...(colorItems.length > 0 ? { colors: colorItems } : {}),
          rehost: true,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const saved = json.data?.saved;
      const parts: string[] = [];
      if (saved?.image_url) parts.push("صورة رئيسية");
      if (saved?.gallery_added?.length) parts.push(`${saved.gallery_added.length} صور معرض`);
      if (saved?.colors_updated?.length) parts.push(`${saved.colors_updated.length} ألوان`);
      setSaveMessage(`✅ تم: ${parts.join("، ") || "بدون تغييرات"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <input
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="UUID المنتج (للحفظ المباشر)"
          className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="استعلام بحث (اختياري إذا UUID موجود)"
          className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-sm"
        />
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="chip chip-active w-full justify-center"
        >
          {loading ? "⏳ AI Gateway يبحث ويصفّي..." : "🔍 ابحث ودع الذكاء يختار"}
        </button>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-[11px] text-muted">
            {result.candidates.length} مرشّح من {result.meta.source_count} مصدر · موديل:{" "}
            <code>{result.meta.model_used}</code> · توكن: {result.meta.tokens}
            {result.curated?.global_notes && (
              <span className="block mt-1 italic">📝 {result.curated.global_notes}</span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {result.candidates.map((c, idx) => {
              const isSelected = selected.has(idx);
              const isPrimary = primary === idx;
              const aiPicked = result.picked.find((p) => p.index === idx);
              return (
                <div
                  key={`${c.url}-${idx}`}
                  className={`card p-2 cursor-pointer transition-all ${
                    isSelected
                      ? isPrimary
                        ? "border-state-success border-2"
                        : "border-brand"
                      : "border-surface-border opacity-80"
                  }`}
                  onClick={() => toggle(idx)}
                >
                  <div className="relative aspect-square overflow-hidden rounded bg-surface-base">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.thumbnail || c.url}
                      alt={c.title || ""}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    {aiPicked && (
                      <div className="absolute top-1 right-1 bg-brand/90 text-white text-[10px] px-1.5 py-0.5 rounded">
                        🤖 {aiPicked.score.toFixed(1)}/10
                      </div>
                    )}
                    {isPrimary && (
                      <div className="absolute top-1 left-1 bg-state-success/90 text-white text-[10px] px-1.5 py-0.5 rounded">
                        ⭐ رئيسية
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-muted truncate">
                    {c.source} · {c.domain || "—"}
                  </div>
                  {aiPicked && (
                    <div className="text-[10px] text-brand mt-1 line-clamp-2">
                      {aiPicked.reason}
                    </div>
                  )}
                  {isSelected && (
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimary(idx);
                        }}
                        className="text-[10px] py-0.5 px-1.5 rounded border border-state-success text-state-success cursor-pointer bg-transparent"
                        disabled={isPrimary}
                      >
                        رئيسية
                      </button>
                      <input
                        type="text"
                        placeholder="لون (اختياري)"
                        value={colorAssign[idx] || ""}
                        onChange={(e) =>
                          setColorAssign((c) => ({ ...c, [idx]: e.target.value }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-[10px] p-1 rounded border border-surface-border bg-transparent"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sticky bottom-2 card p-3 bg-surface-elev">
            <button
              type="button"
              onClick={save}
              disabled={saving || selected.size === 0 || !productId.trim()}
              className="py-2 px-4 rounded-lg bg-brand text-white text-sm font-bold cursor-pointer border-0 disabled:opacity-50"
            >
              {saving
                ? "⏳ جاري الحفظ..."
                : `💾 احفظ ${selected.size} صورة على المنتج`}
            </button>
            {saveMessage && <span className="text-xs text-state-success">{saveMessage}</span>}
            {!productId.trim() && (
              <span className="text-[10px] text-muted">(ألصق UUID لتفعيل الحفظ)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// 🩺 AUDIT
// ────────────────────────────────────────────────

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "كل الأنواع" },
  { value: "device", label: "هواتف" },
  { value: "accessory", label: "إكسسوار" },
  { value: "appliance", label: "أجهزة منزلية" },
  { value: "tv", label: "تلفزيون" },
  { value: "computer", label: "كمبيوتر" },
  { value: "tablet", label: "تابلت" },
  { value: "network", label: "شبكات" },
];

const ISSUE_LABELS: Record<string, string> = {
  low_resolution: "دقة منخفضة",
  blurry: "غير واضحة",
  watermark: "علامة مائية",
  wrong_product: "منتج خاطئ",
  lifestyle_only: "صورة عامة",
  cluttered_background: "خلفية مزدحمة",
  cropped: "مقصوصة",
  color_mismatch: "لون لا يطابق",
  broken: "مكسورة",
  duplicate: "مكررة",
};

function AuditSection() {
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [issueFilter, setIssueFilter] = useState<string>("");

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/intelligence/audit-images", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          limit,
          ...(type ? { type } : {}),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as AuditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الفحص");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="text-muted">النوع</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted">حد المنتجات</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(10, Math.min(500, Number(e.target.value) || 150)))}
              className="w-full mt-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="chip chip-active w-full justify-center"
        >
          {loading ? "⏳ AI يحلّل الصور..." : "🩺 افحص جودة صور الكتالوج"}
        </button>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="مفحوص" value={result.summary.total_scanned} icon="🔍" />
            <Stat label="مشاكل" value={result.summary.problem_count} icon="⚠️" />
            <Stat
              label="متوسط الجودة"
              value={result.summary.avg_score.toFixed(1)}
              icon="⭐"
            />
          </div>
          <div className="text-[10px] text-muted">
            {result.meta.batches} دفعات · {result.meta.total_tokens} توكن ·{" "}
            {(result.meta.durationMs / 1000).toFixed(1)} ث
          </div>

          {result.problems.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setIssueFilter("")}
                className={`text-[10px] px-2 py-1 rounded cursor-pointer border ${
                  issueFilter === ""
                    ? "bg-brand text-white border-brand"
                    : "bg-transparent border-surface-border"
                }`}
              >
                كل ({result.problems.length})
              </button>
              {Object.entries(ISSUE_LABELS).map(([key, label]) => {
                const count = result.problems.filter((p) => p.issues.includes(key)).length;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIssueFilter(issueFilter === key ? "" : key)}
                    className={`text-[10px] px-2 py-1 rounded cursor-pointer border ${
                      issueFilter === key
                        ? "bg-state-error text-white border-state-error"
                        : "bg-transparent border-surface-border"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {result.problems.length === 0 ? (
            <div className="card p-4 text-center text-state-success text-sm">
              ✅ كل الصور نظيفة
            </div>
          ) : (
            <div className="space-y-2">
              {result.problems
                .filter((p) => !issueFilter || p.issues.includes(issueFilter))
                .map((p, i) => (
                <div key={i} className="card p-3 flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    className="w-16 h-16 object-contain rounded bg-surface-base flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <code className="font-mono">{p.product_id.slice(0, 8)}</code>
                      <span className="text-muted">
                        {p.field}
                        {p.field_index !== undefined ? `[${p.field_index}]` : ""}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          p.score < 4 ? "text-state-error" : "text-state-warning"
                        }`}
                      >
                        {p.score.toFixed(1)}/10
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.issues.map((iss) => (
                        <span
                          key={iss}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-state-error/10 text-state-error"
                        >
                          {ISSUE_LABELS[iss] || iss}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-muted mt-1">{p.reason}</div>
                    <a
                      href={`/admin/products?id=${p.product_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-brand underline"
                    >
                      افتح المنتج
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// 🎨 COLOR DETECTOR
// ────────────────────────────────────────────────

function ColorSection() {
  const [imageUrl, setImageUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ColorResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!imageUrl.trim()) {
      setError("ألصق رابط الصورة");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/intelligence/detect-color", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          image_url: imageUrl.trim(),
          ...(productName.trim() ? { product_name: productName.trim() } : {}),
          ...(brand.trim() ? { brand: brand.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as ColorResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الكشف");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="رابط الصورة (https://...)"
          className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="اسم المنتج (اختياري)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="البراند (اختياري)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="chip chip-active w-full justify-center"
        >
          {loading ? "⏳ AI يحلّل اللون..." : "🎨 اكتشف اللون"}
        </button>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-lg border border-surface-border flex-shrink-0"
              style={{ backgroundColor: result.hex }}
            />
            <div className="flex-1">
              <div className="font-mono text-sm font-bold">{result.hex}</div>
              <div className="text-xs">
                {result.name_ar} · {result.name_he} · {result.name_en}
              </div>
              <div className="text-[10px] text-muted">
                ثقة: {(result.confidence * 100).toFixed(0)}%
                {result.notes ? ` · ${result.notes}` : ""}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-muted">
            تقدر تنسخ الـ hex وتلصقه يدوياً بصفحة المنتج، أو ابني عليه ميزة auto-fill لاحقاً.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="card p-3 text-center">
      <div className="text-2xl">{icon}</div>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

// ────────────────────────────────────────────────
// ✅ COLOR VALIDATOR
// ────────────────────────────────────────────────

interface ColorMismatchRow {
  product_id: string;
  color_index: number;
  label: string;
  image_url: string;
  matches: boolean;
  detected_color_name?: string | null;
  confidence: number;
  reason: string;
}

interface ColorValidateResult {
  mismatches: ColorMismatchRow[];
  total_checked: number;
  meta: { batches: number; tokens: number; durationMs: number };
}

function ColorValidateSection() {
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ColorValidateResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/intelligence/validate-colors", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ limit, ...(type ? { type } : {}) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as ColorValidateResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحقق");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="text-muted">النوع</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted">حد المنتجات</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(10, Math.min(500, Number(e.target.value) || 150)))}
              className="w-full mt-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="chip chip-active w-full justify-center"
        >
          {loading ? "⏳ AI يفحص الألوان..." : "✅ تحقّق من صور الألوان"}
        </button>
        <p className="text-[10px] text-muted">
          يقارن صورة كل لون مع تسميته. مفيد بعد bulk-fetch لـ accessories.
        </p>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="مفحوصة" value={result.total_checked} icon="🔍" />
            <Stat label="غير مطابقة" value={result.mismatches.length} icon="⚠️" />
          </div>
          {result.mismatches.length === 0 ? (
            <div className="card p-4 text-center text-state-success text-sm">
              ✅ كل صور الألوان مطابقة لتسمياتها
            </div>
          ) : (
            <div className="space-y-2">
              {result.mismatches.map((m, i) => (
                <div key={i} className="card p-3 flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.image_url}
                    alt=""
                    className="w-16 h-16 object-contain rounded bg-surface-base flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs">
                      <code className="font-mono">{m.product_id.slice(0, 8)}</code> · لون رقم{" "}
                      {m.color_index}
                    </div>
                    <div className="text-sm mt-1">
                      التسمية: <b>{m.label}</b>
                      {m.detected_color_name && (
                        <>
                          {" "}→ ظاهر بالصورة: <b className="text-state-error">{m.detected_color_name}</b>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-muted">{m.reason}</div>
                    <div className="text-[10px] text-muted">
                      ثقة: {(m.confidence * 100).toFixed(0)}%
                    </div>
                    <a
                      href={`/admin/products?id=${m.product_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-brand underline"
                    >
                      افتح المنتج
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// 📄 SPEC SHEET OCR
// ────────────────────────────────────────────────

interface ExtractedSpecsResult {
  specs: Record<string, string>;
  brand_detected?: string | null;
  model_detected?: string | null;
  confidence: number;
  notes?: string;
}

function SpecsSection() {
  const [imageUrl, setImageUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [merge, setMerge] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExtractedSpecsResult | null>(null);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const run = async (saveDirect: boolean) => {
    if (!imageUrl.trim()) {
      setError("ألصق رابط صورة المواصفات");
      return;
    }
    if (saveDirect) {
      if (!productId.trim()) {
        setError("احتاج UUID المنتج للحفظ");
        return;
      }
      setSaving(true);
    } else {
      setLoading(true);
    }
    setError("");
    setSavedMessage("");
    try {
      const res = await fetch("/api/admin/intelligence/extract-specs", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          image_url: imageUrl.trim(),
          ...(productId.trim() ? { product_id: productId.trim() } : {}),
          ...(productName.trim() ? { product_name: productName.trim() } : {}),
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(type.trim() ? { type: type.trim() } : {}),
          merge: saveDirect && merge,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as ExtractedSpecsResult);
      if (saveDirect) {
        setSavedMessage(`✅ تم دمج ${Object.keys(json.data?.specs || {}).length} حقل`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاستخراج");
    }
    setLoading(false);
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="رابط صورة datasheet / كاتالوج / صفحة المصنّع"
          className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="UUID المنتج (للدمج المباشر)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
          />
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="اسم المنتج (تلميح)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="البراند (تلميح)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="النوع (تلميح)"
            className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={merge}
            onChange={(e) => setMerge(e.target.checked)}
          />
          <span>ادمج الحقول المستخرجة مع specs الموجودة (لا يحذف القديم)</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(false)}
            disabled={loading || saving}
            className="chip chip-active flex-1 justify-center"
          >
            {loading ? "⏳ يستخرج..." : "📄 استخرج فقط"}
          </button>
          <button
            type="button"
            onClick={() => run(true)}
            disabled={loading || saving || !productId.trim()}
            className="chip flex-1 justify-center disabled:opacity-50"
          >
            {saving ? "⏳ يحفظ..." : "💾 استخرج + ادمج"}
          </button>
        </div>
        {savedMessage && (
          <div className="text-xs text-state-success">{savedMessage}</div>
        )}
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="card p-3 space-y-2">
          {(result.brand_detected || result.model_detected) && (
            <div className="text-xs text-muted">
              {result.brand_detected && (
                <>براند مكتشف: <b>{result.brand_detected}</b></>
              )}
              {result.brand_detected && result.model_detected && " · "}
              {result.model_detected && (
                <>موديل: <b>{result.model_detected}</b></>
              )}
            </div>
          )}
          <div className="text-[11px] text-muted">
            ثقة: {(result.confidence * 100).toFixed(0)}%
            {result.notes ? ` · ${result.notes}` : ""}
          </div>
          {Object.keys(result.specs).length === 0 ? (
            <div className="text-xs text-state-warning">
              لم يستخرج أي مواصفات — جرّب صورة أوضح أو أعطِ تلميحات.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 text-xs font-mono">
              {Object.entries(result.specs).map(([k, v]) => (
                <div key={k} className="bg-surface-base p-2 rounded">
                  <div className="text-muted text-[10px]">{k}</div>
                  <div className="font-bold">{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// ✍️ ALT-TEXT GENERATOR
// ────────────────────────────────────────────────

interface AltTriple {
  alt_ar: string;
  alt_he: string;
  alt_en: string;
}

interface AltProductResult {
  primary?: AltTriple;
  gallery: AltTriple[];
  colors: { color: string; alt: AltTriple }[];
}

function AltSection() {
  const [productId, setProductId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AltProductResult | null>(null);
  const [error, setError] = useState("");

  const run = async (productMode: boolean) => {
    if (productMode) {
      if (!productId.trim()) {
        setError("ألصق UUID المنتج");
        return;
      }
    } else {
      if (!imageUrl.trim()) {
        setError("ألصق رابط صورة");
        return;
      }
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = productMode
        ? { mode: "product", product_id: productId.trim() }
        : {
            mode: "single",
            image_url: imageUrl.trim(),
            ...(brand.trim() ? { brand: brand.trim() } : {}),
            ...(productName.trim() ? { product_name: productName.trim() } : {}),
          };
      const res = await fetch("/api/admin/intelligence/generate-alt-text", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as AltProductResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التوليد");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <input
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="UUID المنتج (لتوليد alt لكل صوره دفعة واحدة)"
          className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
        />
        <button
          type="button"
          onClick={() => run(true)}
          disabled={loading || !productId.trim()}
          className="chip chip-active w-full justify-center disabled:opacity-50"
        >
          {loading ? "⏳ يكتب alt..." : "✍️ ولّد لكل صور المنتج"}
        </button>
        <div className="border-t border-surface-border pt-2 mt-2 space-y-2">
          <div className="text-[11px] text-muted">— أو لصورة واحدة —</div>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="رابط الصورة"
            className="w-full p-2 rounded-lg border border-surface-border bg-transparent text-xs font-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="البراند (تلميح)"
              className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            />
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="اسم المنتج (تلميح)"
              className="p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={loading}
            className="chip w-full justify-center"
          >
            {loading ? "⏳ يكتب..." : "✍️ ولّد alt واحد"}
          </button>
        </div>
        <p className="text-[10px] text-muted">
          النتيجة للنسخ اليدوي حالياً. لاحقاً ممكن تنزيل migration لإضافة عمود
          gallery_alts للحفظ التلقائي.
        </p>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {result.primary && (
            <AltCard label="🏷 الصورة الرئيسية" alt={result.primary} />
          )}
          {result.gallery.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-bold">📂 معرض ({result.gallery.length})</div>
              {result.gallery.map((alt, i) => (
                <AltCard key={i} label={`صورة ${i + 1}`} alt={alt} />
              ))}
            </div>
          )}
          {result.colors.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-bold">🎨 ألوان ({result.colors.length})</div>
              {result.colors.map((c, i) => (
                <AltCard key={i} label={`لون: ${c.color}`} alt={c.alt} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AltCard({ label, alt }: { label: string; alt: AltTriple }) {
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).catch(() => {});
  };
  return (
    <div className="card p-3 space-y-1 text-xs">
      <div className="font-bold text-muted">{label}</div>
      {(["alt_ar", "alt_he", "alt_en"] as const).map((k) => (
        <div key={k} className="flex items-start gap-2">
          <code className="text-[10px] text-muted flex-shrink-0 w-12">{k.slice(4)}</code>
          <div className="flex-1">{alt[k]}</div>
          <button
            type="button"
            onClick={() => copy(alt[k])}
            className="text-[10px] text-brand underline cursor-pointer bg-transparent border-0"
          >
            نسخ
          </button>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// 🔀 VISUAL DUPLICATE FINDER
// ────────────────────────────────────────────────

interface DuplicateGroupRow {
  product_ids: string[];
  reason: string;
}

interface VisualDupResult {
  groups: DuplicateGroupRow[];
  meta: { groups_scanned: number; tokens: number; durationMs: number };
}

function VisualDuplicatesSection() {
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(300);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualDupResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/intelligence/find-visual-duplicates", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ limit, ...(type ? { type } : {}) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as VisualDupResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الفحص");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="text-muted">النوع</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted">حد المنتجات</span>
            <input
              type="number"
              value={limit}
              onChange={(e) =>
                setLimit(Math.max(10, Math.min(800, Number(e.target.value) || 300)))
              }
              className="w-full mt-1 p-2 rounded-lg border border-surface-border bg-transparent text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="chip chip-active w-full justify-center"
        >
          {loading ? "⏳ AI يقارن الصور..." : "🔀 ابحث عن تكرارات بصرية"}
        </button>
        <p className="text-[10px] text-muted">
          يقارن صور المنتجات (مجمّعة حسب البراند+النوع) ويكشف منتجات مكررة بأسماء مختلفة.
        </p>
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-[11px] text-muted">
            {result.meta.groups_scanned} دفعات · {result.meta.tokens} توكن ·{" "}
            {(result.meta.durationMs / 1000).toFixed(1)} ث
          </div>
          {result.groups.length === 0 ? (
            <div className="card p-4 text-center text-state-success text-sm">
              ✅ لا تكرارات بصرية مكتشفة
            </div>
          ) : (
            <div className="space-y-2">
              {result.groups.map((g, i) => (
                <div key={i} className="card p-3 space-y-2">
                  <div className="text-xs">
                    <b>{g.product_ids.length} منتجات متطابقة بصرياً</b>
                  </div>
                  <div className="text-[11px] text-muted">{g.reason}</div>
                  <div className="flex flex-wrap gap-1">
                    {g.product_ids.map((id) => (
                      <a
                        key={id}
                        href={`/admin/products?id=${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono px-2 py-1 rounded bg-surface-base border border-surface-border text-brand"
                      >
                        {id.slice(0, 8)}
                      </a>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted italic">
                    افتح كل واحد، قرّر أيهم تحتفظ بيه، وامسح الباقي يدوياً (أو استعمل tab "صحة الكتالوج" لحذف نسخ).
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
