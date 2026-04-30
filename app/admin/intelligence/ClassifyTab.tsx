"use client";

import { useEffect, useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import type { ClassificationItem } from "@/lib/intelligence/schemas";

interface UnclassifiedRow {
  id: string;
  name_ar: string;
  name_he: string;
  type: string;
  brand?: string;
  subkind?: string | null;
  appliance_kind?: string | null;
  price?: number;
  description_ar?: string;
  description_he?: string;
  specs?: Record<string, string | number>;
}

interface Suggestion {
  id?: string;
  source_name: string;
  brand: string | null;
  type: string;
  subkind?: string | null;
  appliance_kind?: string | null;
  name_en: string;
  description_ar?: string;
  description_he?: string;
  specs?: Record<string, string | number>;
  confidence?: { brand?: number; type?: number; subkind?: number };
  needs_review?: boolean;
}

interface RowState {
  row: UnclassifiedRow;
  suggestion: Suggestion | null;
  status: "pending" | "loading" | "ready" | "applied" | "skipped" | "error";
  errorMsg?: string;
}

const BATCH_SIZE = 10;

export function ClassifyTab() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ total: 0, applied: 0, skipped: 0 });

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        "/api/admin/products?limit=200&offset=0",
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const filtered = (json.data || []).filter(
        (p: UnclassifiedRow & { needs_classification?: boolean }) =>
          p.needs_classification,
      );
      setRows(filtered.map((r: UnclassifiedRow) => ({
        row: r, suggestion: null, status: "pending" as const,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل القائمة");
    }
    setLoading(false);
  };

  useEffect(() => { loadQueue(); }, []);

  const runBatch = async () => {
    if (running) return;
    setRunning(true);
    setError("");

    const pending = rows.filter((r) => r.status === "pending");
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const slice = pending.slice(i, i + BATCH_SIZE);
      // Mark loading
      setRows((prev) =>
        prev.map((r) =>
          slice.find((s) => s.row.id === r.row.id)
            ? { ...r, status: "loading" }
            : r,
        ),
      );

      try {
        const res = await fetch("/api/admin/intelligence/classify", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            items: slice.map((s) => ({
              id: s.row.id,
              name: s.row.name_ar || s.row.name_he,
              current_brand: s.row.brand,
              current_type: s.row.type,
              current_subkind: s.row.subkind ?? null,
              current_appliance_kind: s.row.appliance_kind ?? null,
              price: typeof s.row.price === "number" ? s.row.price : undefined,
              description_hint:
                (s.row.description_ar || s.row.description_he || "").slice(0, 240) || undefined,
              specs:
                s.row.specs && Object.keys(s.row.specs).length > 0
                  ? s.row.specs
                  : undefined,
            })),
          }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const suggestions = (json.data?.suggestions || []) as Suggestion[];
        setRows((prev) =>
          prev.map((r) => {
            const sug = suggestions.find((s) => s.id === r.row.id);
            if (!sug) return r;
            return { ...r, suggestion: sug, status: "ready" };
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "خطأ";
        setRows((prev) =>
          prev.map((r) =>
            slice.find((s) => s.row.id === r.row.id)
              ? { ...r, status: "error", errorMsg: msg }
              : r,
          ),
        );
      }
    }
    setRunning(false);
  };

  const applyOne = async (
    rowId: string,
    classification: ClassificationItem,
  ) => {
    try {
      const res = await fetch("/api/admin/intelligence/apply", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          items: [{ product_id: rowId, classification, source: "human" }],
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows((prev) =>
        prev.map((r) =>
          r.row.id === rowId ? { ...r, status: "applied" } : r,
        ),
      );
      setStats((s) => ({ ...s, applied: s.applied + 1 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التطبيق");
    }
  };

  const acceptAll = async (minConfidence: number) => {
    const candidates = rows.filter(
      (r) =>
        r.status === "ready" &&
        r.suggestion &&
        avgConf(r.suggestion.confidence) >= minConfidence,
    );
    if (candidates.length === 0) return;

    const items = candidates.map((c) => ({
      product_id: c.row.id,
      classification: c.suggestion as ClassificationItem,
      source: "opus_assisted" as const,
    }));

    try {
      const res = await fetch("/api/admin/intelligence/apply", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const appliedIds = new Set(items.map((i) => i.product_id));
      setRows((prev) =>
        prev.map((r) =>
          appliedIds.has(r.row.id) ? { ...r, status: "applied" } : r,
        ),
      );
      setStats((s) => ({
        ...s,
        applied: s.applied + (json.data?.applied ?? candidates.length),
        skipped: s.skipped + (json.data?.skipped ?? 0),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التطبيق الجماعي");
    }
  };

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const readyCount = rows.filter((r) => r.status === "ready").length;
  const appliedCount = rows.filter((r) => r.status === "applied").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="بحاجة تصنيف" value={rows.length} icon="📋" />
        <Stat label="جاهز للمراجعة" value={readyCount} icon="✨" />
        <Stat label="مُطبَّق" value={appliedCount + stats.applied} icon="✅" />
      </div>

      {error && (
        <div className="card p-3 bg-state-error/10 border-state-error/40 text-state-error text-xs">
          ❌ {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={loadQueue}
          disabled={loading}
          className="chip whitespace-nowrap"
        >
          🔄 تحديث القائمة
        </button>
        <button
          type="button"
          onClick={runBatch}
          disabled={running || pendingCount === 0}
          className="chip chip-active whitespace-nowrap"
        >
          {running ? "⏳ Opus يعمل..." : `🤖 صنّف ${pendingCount} منتج`}
        </button>
        <button
          type="button"
          onClick={() => acceptAll(0.95)}
          disabled={readyCount === 0}
          className="chip whitespace-nowrap"
        >
          ✅ قبول الكل (&gt;95%)
        </button>
        <button
          type="button"
          onClick={() => acceptAll(0.8)}
          disabled={readyCount === 0}
          className="chip whitespace-nowrap"
        >
          ✅ قبول الكل (&gt;80%)
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted">⏳ جاري التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-muted">
          🎉 لا توجد منتجات بحاجة تصنيف.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <RowCard
              key={r.row.id}
              state={r}
              onApply={(c) => applyOne(r.row.id, c)}
              onSkip={() =>
                setRows((prev) =>
                  prev.map((x) =>
                    x.row.id === r.row.id ? { ...x, status: "skipped" } : x,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function avgConf(c?: { brand?: number; type?: number; subkind?: number }): number {
  if (!c) return 0;
  const vals = [c.brand, c.type, c.subkind].filter(
    (v): v is number => typeof v === "number",
  );
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-2xl">{icon}</div>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function RowCard({
  state,
  onApply,
  onSkip,
}: {
  state: RowState;
  onApply: (c: ClassificationItem) => void;
  onSkip: () => void;
}) {
  const { row, suggestion, status } = state;
  return (
    <div className="card p-3">
      <div className="text-xs text-muted mb-1">الحالي:</div>
      <div className="font-bold text-sm mb-1">{row.name_ar || row.name_he}</div>
      <div className="text-[11px] text-muted mb-2">
        type=<b>{row.type}</b> · brand=<b>{row.brand || "—"}</b>
      </div>

      {status === "pending" && (
        <div className="text-[11px] text-muted">⌛ بانتظار التصنيف…</div>
      )}
      {status === "loading" && (
        <div className="text-[11px] text-brand">⏳ Opus يفكر…</div>
      )}
      {status === "applied" && (
        <div className="text-[11px] text-state-success">✅ طُبِّق</div>
      )}
      {status === "skipped" && (
        <div className="text-[11px] text-muted">⏭ تم التخطي</div>
      )}
      {status === "error" && (
        <div className="text-[11px] text-state-error">
          ❌ {state.errorMsg}
        </div>
      )}
      {status === "ready" && suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          onApply={() => onApply(suggestion as ClassificationItem)}
          onSkip={onSkip}
        />
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onApply,
  onSkip,
}: {
  suggestion: Suggestion;
  onApply: () => void;
  onSkip: () => void;
}) {
  const conf = avgConf(suggestion.confidence);
  return (
    <div className="border-t border-surface-border pt-2 mt-2 space-y-1">
      <div className="text-xs text-muted">اقتراح Opus:</div>
      <div className="text-sm">
        <span className="text-muted">type:</span> <b>{suggestion.type}</b>
        {suggestion.subkind ? (
          <>
            {" "}· <span className="text-muted">subkind:</span>{" "}
            <b>{suggestion.subkind}</b>
          </>
        ) : null}
        {suggestion.appliance_kind ? (
          <>
            {" "}· <span className="text-muted">appliance_kind:</span>{" "}
            <b>{suggestion.appliance_kind}</b>
          </>
        ) : null}
      </div>
      <div className="text-sm">
        <span className="text-muted">brand:</span>{" "}
        <b>{suggestion.brand || "—"}</b>
      </div>
      <div className="text-sm">
        <span className="text-muted">name_en:</span>{" "}
        <b className="font-mono">{suggestion.name_en}</b>
      </div>
      <div className="text-[11px] text-muted">
        ثقة: {(conf * 100).toFixed(0)}%{" "}
        {suggestion.needs_review ? "· ⚠️ بحاجة مراجعة" : ""}
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onApply}
          className="py-1.5 px-3 rounded-lg bg-brand text-white text-xs font-bold cursor-pointer border-0"
        >
          ✅ تطبيق
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="py-1.5 px-3 rounded-lg border border-surface-border bg-transparent text-muted text-xs cursor-pointer"
        >
          ⏭ تخطي
        </button>
      </div>
    </div>
  );
}
