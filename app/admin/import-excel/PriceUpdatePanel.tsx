"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/lib/hooks";
import { csrfHeaders, getCsrfToken } from "@/lib/csrf-client";
import { ToastContainer } from "@/components/admin/shared";

interface PriceRow {
  idx: number;
  name: string;
  cash: number;
  monthly: number;
}

interface MatchCandidate {
  productId: string;
  productName: string;
  brand: string;
  score: number;
  reason: string;
}

interface NewProductDraft {
  type: string;
  subkind?: string | null;
  appliance_kind?: string | null;
  brand: string;
  name_ar: string;
  name_he: string;
  name_en: string;
  warranty_months: number;
  variant_kind: string;
  storage_label: string;
  specs: Record<string, string>;
  description_ar: string;
  description_he: string;
  category_hint: string | null;
  category_id: string | null;
}

interface PriceWarning {
  level: "yellow" | "red";
  code: string;
  message: string;
}

interface BatchAnomaly {
  level: "yellow" | "red";
  message: string;
}

type RowStatus = "exact" | "high" | "ambiguous" | "low" | "none" | "will-create";

interface MatchOutputRow {
  idx: number;
  name: string;
  cash: number;
  monthly: number;
  status: RowStatus;
  matched?: {
    productId: string;
    productName: string;
    brand: string;
    variantsCount: number;
    oldPrice: number;
    oldMonthly: number | null;
  };
  candidates: MatchCandidate[];
  newProductDraft?: NewProductDraft;
  warnings: PriceWarning[];
  installments: number;
  // Local UI state
  approved: boolean;
}

interface ApplyResultRow {
  batchId: string;
  updated: number;
  inserted: number;
  failed: Array<{ productId?: string; name?: string; error: string }>;
}

interface LastBatch {
  batchId: string;
  createdAt: string;
  rowCount: number;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  exact: "مطابقة دقيقة",
  high: "مطابقة جيدة",
  ambiguous: "غامضة",
  low: "ضعيفة",
  none: "لا يوجد",
  "will-create": "سيُنشأ منتج جديد",
};

const STATUS_COLOR: Record<RowStatus, string> = {
  exact: "text-emerald-300",
  high: "text-emerald-300",
  ambiguous: "text-amber-300",
  low: "text-amber-300",
  none: "text-slate-400",
  "will-create": "text-blue-300",
};

export function PriceUpdatePanel() {
  const { toasts, show } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reverting, setReverting] = useState(false);

  const [parsedRows, setParsedRows] = useState<PriceRow[] | null>(null);
  const [detectedCols, setDetectedCols] = useState<{ name: number; cash: number; monthly: number } | null>(null);
  const [matchRows, setMatchRows] = useState<MatchOutputRow[] | null>(null);
  const [anomalies, setAnomalies] = useState<BatchAnomaly[]>([]);
  const [applyResult, setApplyResult] = useState<ApplyResultRow | null>(null);
  const [lastBatch, setLastBatch] = useState<LastBatch | null>(null);

  const fetchLastBatch = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/price-update?action=last");
      const data = await res.json();
      if (data.success) setLastBatch(data.data?.batch || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchLastBatch();
  }, [fetchLastBatch]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsedRows(null);
    setMatchRows(null);
    setAnomalies([]);
    setApplyResult(null);
  };

  const doParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/price-update?step=parse", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
        body: fd,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setParsedRows(data.data.rows);
      setDetectedCols(data.data.detectedColumns);
      show(`تمت قراءة ${data.data.totalRows} صف من الملف`);
    } catch (err) {
      show(err instanceof Error ? err.message : "فشلت قراءة الملف", "error");
    } finally {
      setParsing(false);
    }
  };

  const doMatch = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setMatching(true);
    try {
      const res = await fetch("/api/admin/price-update?step=match", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const rows: MatchOutputRow[] = (data.data.rows as Omit<MatchOutputRow, "approved">[]).map(
        (r) => ({
          ...r,
          // Auto-approve high-confidence rows; require manual review for ambiguous/low
          approved: r.status === "exact" || r.status === "high" || r.status === "will-create",
        }),
      );
      setMatchRows(rows);
      setAnomalies(data.data.anomalies || []);
      show(`تمت مطابقة ${rows.length} صف`);
    } catch (err) {
      show(err instanceof Error ? err.message : "فشلت المطابقة", "error");
    } finally {
      setMatching(false);
    }
  };

  const toggleApproved = (idx: number) => {
    if (!matchRows) return;
    const next = matchRows.map((r, i) => (i === idx ? { ...r, approved: !r.approved } : r));
    setMatchRows(next);
  };

  const setBulk = (filter: (r: MatchOutputRow) => boolean, approved: boolean) => {
    if (!matchRows) return;
    setMatchRows(matchRows.map((r) => (filter(r) ? { ...r, approved } : r)));
  };

  const stats = useMemo(() => {
    if (!matchRows) return null;
    const approved = matchRows.filter((r) => r.approved).length;
    const updates = matchRows.filter((r) => r.approved && r.matched).length;
    const creates = matchRows.filter((r) => r.approved && r.status === "will-create").length;
    const warnings = matchRows.filter((r) => r.warnings.length > 0).length;
    const unmatched = matchRows.filter((r) => r.status === "none" || r.status === "low" || r.status === "ambiguous").length;
    return { approved, updates, creates, warnings, unmatched };
  }, [matchRows]);

  const doApply = async () => {
    if (!matchRows) return;
    const approved = matchRows.filter((r) => r.approved);
    if (approved.length === 0) {
      show("لا يوجد صفوف معتمدة للتطبيق", "error");
      return;
    }
    if (
      !confirm(
        `سيتم تحديث ${approved.filter((r) => r.matched).length} منتج وإنشاء ${approved.filter((r) => r.status === "will-create").length} منتج. متابعة؟`,
      )
    )
      return;

    setApplying(true);
    try {
      const payload = approved.map((r) => {
        if (r.matched) {
          return {
            kind: "update" as const,
            productId: r.matched.productId,
            cash: r.cash,
            monthly: r.monthly,
          };
        }
        return {
          kind: "create" as const,
          cash: r.cash,
          monthly: r.monthly,
          draft: r.newProductDraft!,
        };
      });
      const res = await fetch("/api/admin/price-update?step=apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ rows: payload }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setApplyResult(data.data);
      show(`تم تحديث ${data.data.updated} وإنشاء ${data.data.inserted}`);
      fetchLastBatch();
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل التطبيق", "error");
    } finally {
      setApplying(false);
    }
  };

  const doRevert = async (batchId: string) => {
    if (!confirm("التراجع عن آخر دفعة سيُعيد الأسعار السابقة وسيُلغي تفعيل المنتجات الجديدة. متابعة؟")) return;
    setReverting(true);
    try {
      const res = await fetch("/api/admin/price-update?step=revert", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      show(`تم التراجع عن ${data.data.reverted} تغيير`);
      setLastBatch(null);
      fetchLastBatch();
    } catch (err) {
      show(err instanceof Error ? err.message : "فشل التراجع", "error");
    } finally {
      setReverting(false);
    }
  };

  return (
    <div>
      {/* Last batch revert button */}
      {lastBatch && !applyResult && (
        <div className="card mb-4 flex items-center justify-between" style={{ padding: 12 }}>
          <div className="text-xs">
            <span className="text-muted">آخر دفعة: </span>
            <span className="font-mono">{lastBatch.batchId.slice(0, 8)}</span>
            <span className="text-muted"> • {lastBatch.rowCount} تغيير • </span>
            <span>{new Date(lastBatch.createdAt).toLocaleString("ar")}</span>
          </div>
          <button
            type="button"
            onClick={() => doRevert(lastBatch.batchId)}
            disabled={reverting}
            className="btn-ghost text-xs disabled:opacity-50"
            style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}
          >
            {reverting ? "جاري التراجع..." : "↶ التراجع عن آخر دفعة"}
          </button>
        </div>
      )}

      {/* Step 1 — upload */}
      <div className="card mb-4" style={{ padding: 14 }}>
        <h3 className="font-bold text-sm mb-2">المرحلة 1 — رفع ملف الأسعار</h3>
        <p className="text-[11px] text-muted mb-2">
          الملف يحتوي ٣ أعمدة على الأقل: اسم المنتج، السعر الكاش، القسط ×36. الأعمدة تُكتشف تلقائيًا بأي ترتيب وأي لغة (عربي/عبري/إنجليزي).
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="text-xs" />
          <button
            type="button"
            onClick={doParse}
            disabled={!file || parsing}
            className="btn-primary disabled:opacity-50"
          >
            {parsing ? "جاري القراءة..." : "اقرأ الملف"}
          </button>
        </div>
        {detectedCols && parsedRows && (
          <div className="mt-3 text-[11px] text-muted">
            تم اكتشاف الأعمدة (الاسم: {detectedCols.name}، السعر: {detectedCols.cash}، القسط: {detectedCols.monthly}) • {parsedRows.length} صف صالح.
          </div>
        )}
      </div>

      {/* Step 2 — match */}
      {parsedRows && parsedRows.length > 0 && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <h3 className="font-bold text-sm mb-2">المرحلة 2 — المطابقة بالذكاء</h3>
          <p className="text-[11px] text-muted mb-2">
            يطابق الأسماء مع المنتجات الموجودة. غير المطابقة تُصنّف كمنتجات جديدة بـ AI (تُنشأ غير مفعّلة).
          </p>
          <button
            type="button"
            onClick={doMatch}
            disabled={matching}
            className="btn-primary disabled:opacity-50"
          >
            {matching ? "جاري المطابقة..." : "ابدأ المطابقة"}
          </button>
        </div>
      )}

      {/* Step 3 — preview */}
      {matchRows && stats && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <h3 className="font-bold text-sm mb-2">المرحلة 3 — المعاينة قبل التطبيق</h3>

          {/* Anomaly banners */}
          {anomalies.length > 0 && (
            <div className="mb-3 space-y-2">
              {anomalies.map((a, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3 text-xs"
                  style={{
                    background: a.level === "red" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                    border:
                      a.level === "red"
                        ? "1px solid rgba(239,68,68,0.3)"
                        : "1px solid rgba(245,158,11,0.3)",
                    color: a.level === "red" ? "#ef4444" : "#f59e0b",
                  }}
                >
                  ⚠ {a.message}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            <Stat label="معتمد للتطبيق" value={stats.approved} green />
            <Stat label="تحديثات" value={stats.updates} />
            <Stat label="إنشاءات" value={stats.creates} />
            <Stat label="بتحذيرات" value={stats.warnings} yellow />
            <Stat label="غير مطابقة" value={stats.unmatched} red />
          </div>

          <div className="flex gap-2 flex-wrap mb-3 text-xs">
            <button type="button" onClick={() => setBulk(() => true, true)} className="btn-ghost text-xs">
              اعتماد الكل
            </button>
            <button type="button" onClick={() => setBulk(() => true, false)} className="btn-ghost text-xs">
              إلغاء الكل
            </button>
            <button
              type="button"
              onClick={() => setBulk((r) => r.status === "exact" || r.status === "high", true)}
              className="btn-ghost text-xs"
            >
              اعتماد المطابقة الجيدة فقط
            </button>
            <button
              type="button"
              onClick={() => setBulk((r) => r.warnings.length === 0, true)}
              className="btn-ghost text-xs"
            >
              اعتماد بلا تحذيرات
            </button>
          </div>

          <button
            type="button"
            onClick={doApply}
            disabled={applying || stats.approved === 0}
            className="btn-primary disabled:opacity-50 mb-3"
          >
            {applying ? "جاري التطبيق..." : `طبّق ${stats.approved} صف`}
          </button>

          {applyResult && (
            <div
              className="rounded-xl p-3 mb-3 text-sm"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#10b981",
              }}
            >
              ✓ تم تحديث {applyResult.updated} منتج وإنشاء {applyResult.inserted} منتج جديد.
              <span className="text-muted text-xs"> (Batch: {applyResult.batchId.slice(0, 8)})</span>
              {applyResult.failed.length > 0 && (
                <div className="mt-2 text-state-error text-xs">
                  فشل {applyResult.failed.length} صف:
                  <ul className="mt-1">
                    {applyResult.failed.slice(0, 5).map((f, i) => (
                      <li key={i}>
                        • {f.productId || f.name}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={() => doRevert(applyResult.batchId)}
                disabled={reverting}
                className="btn-ghost text-xs mt-2"
                style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}
              >
                {reverting ? "جاري التراجع..." : "↶ التراجع عن هذه الدفعة"}
              </button>
            </div>
          )}

          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="w-full text-[11px] text-right">
              <thead className="sticky top-0 bg-surface-card text-muted">
                <tr>
                  <th className="p-1.5">✓</th>
                  <th className="p-1.5">اسم Excel</th>
                  <th className="p-1.5">الحالة</th>
                  <th className="p-1.5">المنتج المطابَق</th>
                  <th className="p-1.5">السعر (قديم → جديد)</th>
                  <th className="p-1.5">القسط (قديم → جديد)</th>
                  <th className="p-1.5">تحذيرات</th>
                </tr>
              </thead>
              <tbody>
                {matchRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-surface-border"
                    style={{ opacity: row.approved ? 1 : 0.5 }}
                  >
                    <td className="p-1.5">
                      <input
                        type="checkbox"
                        checked={row.approved}
                        onChange={() => toggleApproved(i)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-1.5 max-w-[180px] truncate" title={row.name}>
                      {row.name}
                    </td>
                    <td className={`p-1.5 ${STATUS_COLOR[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </td>
                    <td className="p-1.5">
                      {row.matched ? (
                        <div>
                          <div className="font-medium">{row.matched.productName}</div>
                          <div className="text-[10px] text-muted">
                            {row.matched.brand} • {row.matched.variantsCount} variants
                          </div>
                        </div>
                      ) : row.newProductDraft ? (
                        <div>
                          <div className="text-blue-300 font-medium">
                            جديد: {row.newProductDraft.name_ar}
                          </div>
                          <div className="text-[10px] text-muted">
                            {row.newProductDraft.type} • {row.newProductDraft.brand} • {row.newProductDraft.storage_label}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-1.5" dir="ltr">
                      {row.matched ? (
                        <>
                          <span className="text-muted">₪{row.matched.oldPrice.toLocaleString()}</span>
                          {" → "}
                          <span className="font-bold">₪{row.cash.toLocaleString()}</span>
                        </>
                      ) : (
                        <span className="font-bold">₪{row.cash.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="p-1.5" dir="ltr">
                      {row.matched && row.matched.oldMonthly ? (
                        <>
                          <span className="text-muted">₪{row.matched.oldMonthly.toLocaleString()}</span>
                          {" → "}
                          <span className="font-bold text-purple-300">₪{row.monthly.toLocaleString()}</span>
                        </>
                      ) : row.monthly > 0 ? (
                        <span className="font-bold text-purple-300">₪{row.monthly.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-1.5">
                      {row.warnings.map((w, wi) => (
                        <div
                          key={wi}
                          className="text-[10px]"
                          style={{ color: w.level === "red" ? "#ef4444" : "#f59e0b" }}
                          title={w.message}
                        >
                          ⚠ {w.message}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

function Stat({
  label,
  value,
  red,
  yellow,
  green,
}: {
  label: string;
  value: number;
  red?: boolean;
  yellow?: boolean;
  green?: boolean;
}) {
  const color = red ? "#ef4444" : yellow ? "#f59e0b" : green ? "#10b981" : "#a8a8b3";
  const bg = red
    ? "rgba(239,68,68,0.08)"
    : yellow
      ? "rgba(245,158,11,0.08)"
      : green
        ? "rgba(16,185,129,0.08)"
        : "rgba(168,168,179,0.06)";
  const border = red
    ? "rgba(239,68,68,0.2)"
    : yellow
      ? "rgba(245,158,11,0.2)"
      : green
        ? "rgba(16,185,129,0.2)"
        : "rgba(168,168,179,0.15)";
  return (
    <div className="rounded-xl p-2 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-bold text-lg" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
