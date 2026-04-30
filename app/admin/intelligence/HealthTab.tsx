"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import type { HealthReport } from "@/lib/intelligence/schemas";

interface HealthResult {
  report: HealthReport;
  meta: {
    rows: number;
    tokens: { input: number; output: number; cacheRead: number };
  };
}

type Status = "idle" | "loading" | "done" | "error";
type FixState = { status: Status; message?: string };
type ProductType = "device" | "accessory" | "appliance" | "tv" | "computer" | "tablet" | "network";

// Maps each product type to the admin page that actually edits it.
function adminLinkFor(type: string | undefined, id: string): string {
  switch (type) {
    case "device":
      return `/admin/phones?id=${id}`;
    case "accessory":
      return `/admin/accessories?id=${id}`;
    case "appliance":
      return `/admin/appliances?id=${id}`;
    case "tv":
      return `/admin/tvs?id=${id}`;
    case "computer":
      return `/admin/computers?id=${id}`;
    case "tablet":
      return `/admin/tablets?id=${id}`;
    case "network":
      return `/admin/network?id=${id}`;
    default:
      return `/admin/products?id=${id}`;
  }
}

async function postFix(body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/admin/intelligence/fix", {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.error) return { ok: false, message: json.error };
    return { ok: true, message: "تم" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "خطأ" };
  }
}

export function HealthTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);
  const [error, setError] = useState("");
  const [fixState, setFixState] = useState<Record<string, FixState>>({});

  const setFix = (key: string, state: FixState) =>
    setFixState((prev) => ({ ...prev, [key]: state }));

  // Optimistically removes a section item by predicate after a successful fix
  // so the user sees the queue actually shrink.
  const removeFromReport = <K extends keyof HealthReport>(
    section: K,
    predicate: (item: HealthReport[K] extends Array<infer I> ? I : never) => boolean,
  ) => {
    setResult((prev) => {
      if (!prev) return prev;
      const list = prev.report[section];
      if (!Array.isArray(list)) return prev;
      const next = list.filter((it) => !predicate(it as never));
      const removed = list.length - next.length;
      return {
        ...prev,
        report: {
          ...prev.report,
          [section]: next,
          summary: {
            ...prev.report.summary,
            total_issues: Math.max(0, prev.report.summary.total_issues - removed),
          },
        },
      };
    });
  };

  const run = async () => {
    setLoading(true);
    setError("");
    setFixState({});
    try {
      const res = await fetch("/api/admin/intelligence/health");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data as HealthResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحليل");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <button type="button" onClick={run} disabled={loading} className="chip chip-active">
          {loading ? "⏳ Opus يحلّل الكتالوج..." : "🩺 شغّل فحص الصحة"}
        </button>
        {result && (
          <span className="text-[11px] text-muted mr-3">
            صفوف محلَّلة: {result.meta.rows} · توكن:{" "}
            {result.meta.tokens.input + result.meta.tokens.output}{" "}
            (cache: {result.meta.tokens.cacheRead})
          </span>
        )}
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="card p-4 text-center bg-brand/5 border-brand/40">
            <div className="text-3xl font-black text-brand">
              {result.report.summary.score} / 100
            </div>
            <div className="text-xs text-muted">
              {result.report.summary.total_issues} مشكلة مكتشفة
            </div>
          </div>

          {/* DUPLICATES */}
          <Section
            title="🔁 منتجات مكررة"
            empty="لا توجد تكرارات"
            items={result.report.duplicates}
            renderKey={(_d, i) => `dup-${i}`}
            render={(d, key) => (
              <DuplicateFix
                ids={d.ids}
                name={d.name}
                reason={d.reason}
                state={fixState[key]}
                onFix={async (keepId) => {
                  setFix(key, { status: "loading" });
                  const r = await postFix({
                    action: "delete_duplicates",
                    keep_id: keepId,
                    remove_ids: d.ids.filter((x) => x !== keepId),
                  });
                  setFix(key, {
                    status: r.ok ? "done" : "error",
                    message: r.message,
                  });
                  if (r.ok) {
                    const removedIds = new Set(d.ids.filter((x) => x !== keepId));
                    // Drop this duplicate group from the queue.
                    removeFromReport("duplicates", (item) => item === d);
                    // And purge any other section pointing at the deleted ids.
                    setResult((prev) => {
                      if (!prev) return prev;
                      const r2 = prev.report;
                      return {
                        ...prev,
                        report: {
                          ...r2,
                          missing_fields: r2.missing_fields.filter((m) => !removedIds.has(m.id)),
                          missing_subkind: r2.missing_subkind.filter((m) => !removedIds.has(m.id)),
                          type_misclassified: r2.type_misclassified.filter((t) => !removedIds.has(t.id)),
                        },
                      };
                    });
                  }
                }}
              />
            )}
          />

          {/* BRAND INCONSISTENCY */}
          <Section
            title="🏷 تضارب في تسمية البراند"
            empty="لا تضارب"
            items={result.report.brand_inconsistency}
            renderKey={(_b, i) => `brand-${i}`}
            render={(b, key) => (
              <BrandFix
                ids={b.ids}
                currentBrands={b.current_brands}
                suggested={b.suggested}
                state={fixState[key]}
                onFix={async () => {
                  setFix(key, { status: "loading" });
                  const r = await postFix({
                    action: "apply_brand",
                    product_ids: b.ids,
                    brand: b.suggested,
                  });
                  setFix(key, {
                    status: r.ok ? "done" : "error",
                    message: r.message,
                  });
                  if (r.ok) removeFromReport("brand_inconsistency", (item) => item === b);
                }}
              />
            )}
          />

          {/* MISSING FIELDS */}
          <Section
            title="📋 حقول ناقصة"
            empty="لا حقول ناقصة"
            items={result.report.missing_fields}
            renderKey={(m) => `miss-${m.id}`}
            render={(m, key) => (
              <MissingFieldsFix
                id={m.id}
                missing={m.missing}
                state={fixState[key]}
                onFix={async () => {
                  setFix(key, { status: "loading" });
                  const r = await postFix({
                    action: "generate_descriptions",
                    product_id: m.id,
                  });
                  setFix(key, {
                    status: r.ok ? "done" : "error",
                    message: r.message,
                  });
                  if (r.ok) removeFromReport("missing_fields", (item) => item.id === m.id);
                }}
              />
            )}
            bulk={
              result.report.missing_fields.length > 1
                ? {
                    label: `✍️ ولّد للكل (${
                      result.report.missing_fields.filter((m) =>
                        m.missing.every((f) => f.includes("description") || f === "name_en"),
                      ).length
                    })`,
                    run: async () => {
                      const targets = result.report.missing_fields.filter((m) =>
                        m.missing.every((f) => f.includes("description") || f === "name_en"),
                      );
                      for (const m of targets) {
                        const key = `miss-${m.id}`;
                        setFix(key, { status: "loading" });
                        const r = await postFix({
                          action: "generate_descriptions",
                          product_id: m.id,
                        });
                        setFix(key, {
                          status: r.ok ? "done" : "error",
                          message: r.message,
                        });
                        if (r.ok) removeFromReport("missing_fields", (item) => item.id === m.id);
                      }
                    },
                  }
                : undefined
            }
          />

          {/* TYPE MISCLASSIFIED */}
          <Section
            title="🎯 تصنيف خاطئ"
            empty="كل التصنيفات سليمة"
            items={result.report.type_misclassified}
            renderKey={(t) => `type-${t.id}`}
            render={(t, key) => (
              <TypeFix
                id={t.id}
                currentType={t.current_type}
                suggestedType={t.suggested_type}
                reason={t.reason}
                state={fixState[key]}
                onFix={async (kind) => {
                  setFix(key, { status: "loading" });
                  const r = await postFix({
                    action: "apply_type",
                    product_id: t.id,
                    type: t.suggested_type,
                    ...(kind ? { appliance_kind: kind } : {}),
                  });
                  setFix(key, {
                    status: r.ok ? "done" : "error",
                    message: r.message,
                  });
                  if (r.ok) removeFromReport("type_misclassified", (item) => item.id === t.id);
                }}
              />
            )}
          />

          {/* PRICE OUTLIERS — review only, no auto-fix */}
          <Section
            title="💰 شذوذ في الأسعار"
            empty="الأسعار متّسقة"
            items={result.report.price_outliers}
            renderKey={(_p, i) => `price-${i}`}
            render={(p) => (
              <div>
                <div className="font-bold text-sm">{p.model}</div>
                <div className="text-[11px] text-muted">
                  أسعار: {p.prices.map((x) => `₪${x}`).join(" / ")}
                </div>
                <div className="text-[10px] text-muted">{p.reason}</div>
                <div className="flex gap-1 flex-wrap mt-2">
                  {p.ids.slice(0, 5).map((id) => (
                    <a
                      key={id}
                      href={adminLinkFor(undefined, id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono underline text-brand"
                    >
                      {id.slice(0, 8)}
                    </a>
                  ))}
                </div>
                <div className="text-[10px] text-muted italic mt-1">
                  ⚠️ الأسعار قرار بشري — افتح الروابط للمراجعة اليدوية.
                </div>
              </div>
            )}
          />

          {/* MISSING SUBKIND */}
          <Section
            title="🏷 subkind ناقص"
            empty="كل المنتجات لها subkind"
            items={result.report.missing_subkind}
            renderKey={(s) => `sub-${s.id}`}
            render={(s, key) => (
              <SubkindFix
                id={s.id}
                type={s.type}
                suggestedSubkind={s.suggested_subkind}
                state={fixState[key]}
                onFix={async () => {
                  setFix(key, { status: "loading" });
                  const r = await postFix({
                    action: "apply_subkind",
                    product_id: s.id,
                    subkind: s.suggested_subkind,
                  });
                  setFix(key, {
                    status: r.ok ? "done" : "error",
                    message: r.message,
                  });
                  if (r.ok) removeFromReport("missing_subkind", (item) => item.id === s.id);
                }}
              />
            )}
            bulk={
              result.report.missing_subkind.length > 1
                ? {
                    label: `🔧 طبّق الكل (${result.report.missing_subkind.length})`,
                    run: async () => {
                      for (const s of result.report.missing_subkind) {
                        const key = `sub-${s.id}`;
                        setFix(key, { status: "loading" });
                        const r = await postFix({
                          action: "apply_subkind",
                          product_id: s.id,
                          subkind: s.suggested_subkind,
                        });
                        setFix(key, {
                          status: r.ok ? "done" : "error",
                          message: r.message,
                        });
                        if (r.ok) removeFromReport("missing_subkind", (item) => item.id === s.id);
                      }
                    },
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function Section<T>({
  title,
  empty,
  items,
  renderKey,
  render,
  bulk,
}: {
  title: string;
  empty: string;
  items: T[];
  renderKey: (item: T, i: number) => string;
  render: (item: T, key: string) => React.ReactNode;
  bulk?: { label: string; run: () => Promise<void> };
}) {
  const [open, setOpen] = useState(true);
  const [bulkRunning, setBulkRunning] = useState(false);
  return (
    <div className="card p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-right cursor-pointer bg-transparent border-0 p-0"
      >
        <span className="font-bold text-sm">{title}</span>
        <span className="text-xs text-muted">
          {items.length} {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {bulk && items.length > 0 && (
            <button
              type="button"
              disabled={bulkRunning}
              onClick={async () => {
                setBulkRunning(true);
                try {
                  await bulk.run();
                } finally {
                  setBulkRunning(false);
                }
              }}
              className="py-1 px-3 rounded-lg bg-brand/20 text-brand text-[11px] font-bold cursor-pointer border border-brand/40 disabled:opacity-50"
            >
              {bulkRunning ? "⏳ جاري المعالجة..." : bulk.label}
            </button>
          )}
          {items.length === 0 ? (
            <div className="text-[11px] text-muted py-2">✅ {empty}</div>
          ) : (
            items.map((item, i) => {
              const key = renderKey(item, i);
              return (
                <div
                  key={key}
                  className="border-t border-surface-border pt-2 first:border-0 first:pt-0"
                >
                  {render(item, key)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state?: FixState }) {
  if (!state || state.status === "idle") return null;
  if (state.status === "loading") {
    return <span className="text-[10px] text-brand">⏳ جاري...</span>;
  }
  if (state.status === "done") {
    return <span className="text-[10px] text-state-success">✅ تم</span>;
  }
  return (
    <span className="text-[10px] text-state-error">❌ {state.message}</span>
  );
}

function DuplicateFix({
  ids,
  name,
  reason,
  state,
  onFix,
}: {
  ids: string[];
  name: string;
  reason: string;
  state?: FixState;
  onFix: (keepId: string) => void;
}) {
  const [keepId, setKeepId] = useState(ids[0]);
  const done = state?.status === "done";
  return (
    <div className={done ? "opacity-50" : ""}>
      <div className="font-bold text-sm">{name}</div>
      <div className="text-[11px] text-muted">{reason}</div>
      <div className="text-[10px] text-muted mt-1">
        {ids.length} نسخة. اختر التي تريدين الإبقاء عليها:
      </div>
      <div className="space-y-1 mt-2">
        {ids.map((id) => (
          <label
            key={id}
            className="flex items-center gap-2 text-[11px] font-mono cursor-pointer"
          >
            <input
              type="radio"
              name={`keep-${ids.join("-")}`}
              checked={keepId === id}
              onChange={() => setKeepId(id)}
              disabled={done || state?.status === "loading"}
            />
            <span>{id}</span>
            <a
              href={adminLinkFor(undefined, id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              فتح
            </a>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          disabled={done || state?.status === "loading"}
          onClick={() => onFix(keepId)}
          className="py-1 px-3 rounded-lg bg-state-error text-white text-[11px] font-bold cursor-pointer border-0 disabled:opacity-50"
        >
          🗑 احذف الباقي ({ids.length - 1})
        </button>
        <StatusBadge state={state} />
      </div>
    </div>
  );
}

function BrandFix({
  ids,
  currentBrands,
  suggested,
  state,
  onFix,
}: {
  ids: string[];
  currentBrands: string[];
  suggested: string;
  state?: FixState;
  onFix: () => void;
}) {
  const done = state?.status === "done";
  return (
    <div className={done ? "opacity-50" : ""}>
      <div className="text-sm">
        المقترح: <b>{suggested}</b>
      </div>
      <div className="text-[11px] text-muted">
        حالياً: {currentBrands.join(" / ")} ({ids.length} منتج)
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          disabled={done || state?.status === "loading"}
          onClick={onFix}
          className="py-1 px-3 rounded-lg bg-brand text-white text-[11px] font-bold cursor-pointer border-0 disabled:opacity-50"
        >
          🔧 طبّق &quot;{suggested}&quot; على {ids.length}
        </button>
        <StatusBadge state={state} />
      </div>
    </div>
  );
}

function MissingFieldsFix({
  id,
  missing,
  state,
  onFix,
}: {
  id: string;
  missing: string[];
  state?: FixState;
  onFix: () => void;
}) {
  const done = state?.status === "done";
  const onlyDescriptions = missing.every((m) =>
    m.includes("description") || m === "name_en",
  );
  return (
    <div className={`flex items-center justify-between gap-2 ${done ? "opacity-50" : ""}`}>
      <div className="text-xs">
        <span className="font-mono">{id.slice(0, 8)}</span> →{" "}
        <span className="text-muted">{missing.join(", ")}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onlyDescriptions ? (
          <>
            <button
              type="button"
              disabled={done || state?.status === "loading"}
              onClick={onFix}
              className="py-1 px-3 rounded-lg bg-brand text-white text-[11px] font-bold cursor-pointer border-0 disabled:opacity-50"
            >
              ✍️ ولّد
            </button>
            <StatusBadge state={state} />
          </>
        ) : (
          <a
            href={adminLinkFor(undefined, id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-brand underline"
          >
            افتح للتعديل
          </a>
        )}
      </div>
    </div>
  );
}

function TypeFix({
  id,
  currentType,
  suggestedType,
  reason,
  state,
  onFix,
}: {
  id: string;
  currentType: string;
  suggestedType: ProductType;
  reason: string;
  state?: FixState;
  onFix: (applianceKind?: string) => void;
}) {
  const done = state?.status === "done";
  const [kindInput, setKindInput] = useState("");
  const needsKind = suggestedType === "appliance";
  return (
    <div className={done ? "opacity-50" : ""}>
      <div className="text-sm">
        <span className="text-state-error">{currentType}</span> →{" "}
        <b className="text-state-success">{suggestedType}</b>
      </div>
      <div className="text-[11px] text-muted">{reason}</div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-mono">{id.slice(0, 8)}</span>
        <a
          href={adminLinkFor(currentType, id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline"
        >
          فتح
        </a>
      </div>
      {needsKind && (
        <input
          type="text"
          value={kindInput}
          onChange={(e) => setKindInput(e.target.value)}
          placeholder="appliance_kind (مثال: stick_vacuum)"
          disabled={done || state?.status === "loading"}
          className="mt-2 w-full p-1.5 rounded-lg border border-surface-border bg-transparent text-[11px] font-mono"
        />
      )}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          disabled={done || state?.status === "loading"}
          onClick={() => onFix(needsKind ? kindInput.trim() || undefined : undefined)}
          className="py-1 px-3 rounded-lg bg-brand text-white text-[11px] font-bold cursor-pointer border-0 disabled:opacity-50"
        >
          🎯 طبّق
        </button>
        <StatusBadge state={state} />
      </div>
    </div>
  );
}

function SubkindFix({
  id,
  type,
  suggestedSubkind,
  state,
  onFix,
}: {
  id: string;
  type: string;
  suggestedSubkind: string;
  state?: FixState;
  onFix: () => void;
}) {
  const done = state?.status === "done";
  return (
    <div className={`flex items-center justify-between gap-2 ${done ? "opacity-50" : ""}`}>
      <div className="text-xs">
        <span className="font-mono">{id.slice(0, 8)}</span> ({type}) → اقتراح:{" "}
        <b>{suggestedSubkind}</b>
        <a
          href={adminLinkFor(type, id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline mr-2"
        >
          فتح
        </a>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          disabled={done || state?.status === "loading"}
          onClick={onFix}
          className="py-1 px-3 rounded-lg bg-brand text-white text-[11px] font-bold cursor-pointer border-0 disabled:opacity-50"
        >
          🔧 طبّق
        </button>
        <StatusBadge state={state} />
      </div>
    </div>
  );
}
