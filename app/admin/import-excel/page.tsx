"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useToast } from "@/lib/hooks";
import { PageHeader, ToastContainer } from "@/components/admin/shared";
import { csrfHeaders, getCsrfToken } from "@/lib/csrf-client";
import { PriceUpdatePanel } from "./PriceUpdatePanel";

type ImportMode = "create" | "update" | "update-accessories";

interface RawRow {
  sheet: string;
  brand_section: string;
  barcode: string;
  desc: string;
  model: string;
  stock: number;
  monthly: number;
  cash: number;
  is_hot_supply: boolean;
}

interface ClassifiedRow extends RawRow {
  type: string;
  subkind?: string | null;
  appliance_kind?: string | null;
  brand: string;
  name_ar: string;
  name_he: string;
  name_en: string;
  warranty_months: number;
  variant_kind: string;
  specs: Record<string, string>;
  cost: number;
  group_key: string;
  variant_label: string;
  skip: boolean;
  skip_reason?: string;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeRawRow(row: RawRow): RawRow {
  return {
    ...row,
    stock: toSafeNumber(row.stock),
    monthly: toSafeNumber(row.monthly),
    cash: toSafeNumber(row.cash),
  };
}

function normalizeClassifiedRow(row: ClassifiedRow): ClassifiedRow {
  return {
    ...row,
    stock: toSafeNumber(row.stock),
    monthly: toSafeNumber(row.monthly),
    cash: toSafeNumber(row.cash),
    cost: toSafeNumber(row.cost),
  };
}

const TYPE_LABEL: Record<string, string> = {
  tv: "تلفزيون",
  computer: "حاسوب",
  tablet: "جهاز لوحي",
  network: "شبكات",
  appliance: "جهاز منزلي",
};

export default function ImportExcelPage() {
  const [mode, setMode] = useState<ImportMode>("create");
  const { toasts, show } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);
  const [classified, setClassified] = useState<ClassifiedRow[] | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    after_mobile_filter: number;
    hot_duplicates: number;
    sheets: string[];
  } | null>(null);
  const [insertResult, setInsertResult] = useState<{
    inserted: number;
    total_groups: number;
    errors: string[];
  } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setRawRows(null);
    setClassified(null);
    setInsertResult(null);
  };

  const doParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/import-excel?step=parse", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
        body: fd,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "فشل القراءة");

      const normalizedRows = (data.data.rows as RawRow[]).map(normalizeRawRow);
      setRawRows(normalizedRows);
      setStats(data.data.stats);
      show(`تمت قراءة ${normalizedRows.length} صف من الملف`);
    } catch (err) {
      show(err instanceof Error ? err.message : "حدث خطأ أثناء قراءة الملف", "error");
    } finally {
      setParsing(false);
    }
  };

  const doClassify = async () => {
    if (!rawRows) return;
    setClassifying(true);
    try {
      const res = await fetch("/api/admin/import-excel?step=classify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ rows: rawRows }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "فشل التصنيف");

      const normalizedClassified = (data.data.classified as ClassifiedRow[]).map(
        normalizeClassifiedRow,
      );
      setClassified(normalizedClassified);
      show(`تم تصنيف ${normalizedClassified.length} صف`);
    } catch (err) {
      show(err instanceof Error ? err.message : "حدث خطأ أثناء التصنيف", "error");
    } finally {
      setClassifying(false);
    }
  };

  const doInsert = async () => {
    if (!classified) return;
    const rowsForInsert = classified.map(normalizeClassifiedRow);
    const count = rowsForInsert.filter((row) => !row.skip).length;
    if (!confirm(`سيتم إدراج ${count} صف بعد التجميع. هل تريد المتابعة؟`)) return;

    setInserting(true);
    try {
      const res = await fetch("/api/admin/import-excel?step=insert", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ rows: rowsForInsert }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "فشل الإدراج");
      setInsertResult(data.data);
      show(`تم إدراج ${data.data.inserted} منتج`);
    } catch (err) {
      show(err instanceof Error ? err.message : "حدث خطأ أثناء الإدراج", "error");
    } finally {
      setInserting(false);
    }
  };

  const toggleSkip = (idx: number) => {
    if (!classified) return;
    const next = [...classified];
    next[idx] = { ...normalizeClassifiedRow(next[idx]), skip: !next[idx].skip };
    setClassified(next);
  };

  const updateRowField = (idx: number, key: keyof ClassifiedRow, value: unknown) => {
    if (!classified) return;
    const next = [...classified];
    next[idx] = normalizeClassifiedRow({
      ...next[idx],
      [key]: value,
    } as ClassifiedRow);
    setClassified(next);
  };

  const safeClassified = classified?.map(normalizeClassifiedRow) ?? null;
  const insertableCount = safeClassified?.filter((row) => !row.skip).length ?? 0;

  const counts = safeClassified
    ? safeClassified.reduce(
        (acc, row) => {
          if (row.skip) acc.skipped++;
          else acc[row.type as keyof typeof acc] = (acc[row.type as keyof typeof acc] || 0) + 1;
          return acc;
        },
        {
          skipped: 0,
          tv: 0,
          computer: 0,
          tablet: 0,
          network: 0,
          appliance: 0,
        } as Record<string, number>,
      )
    : null;

  return (
    <div>
      <PageHeader title="استيراد من Excel" />

      <div className="card mb-4 flex gap-2 flex-wrap" style={{ padding: 8 }}>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={mode === "create" ? "btn-primary text-xs" : "btn-ghost text-xs"}
        >
          استيراد منتجات جديدة
        </button>
        <button
          type="button"
          onClick={() => setMode("update")}
          className={mode === "update" ? "btn-primary text-xs" : "btn-ghost text-xs"}
        >
          تحديث أسعار الموبايلات (مع قسط)
        </button>
        <button
          type="button"
          onClick={() => setMode("update-accessories")}
          className={mode === "update-accessories" ? "btn-primary text-xs" : "btn-ghost text-xs"}
        >
          تحديث أسعار الإكسسوارات والأجهزة (سعر فقط)
        </button>
      </div>

      {mode === "update" && <PriceUpdatePanel mode="phones" />}
      {mode === "update-accessories" && <PriceUpdatePanel mode="accessories" />}

      {mode === "create" && (
      <>
      <div className="card mb-4" style={{ padding: 14 }}>
        <h3 className="font-bold text-sm mb-2">المرحلة 1 - رفع الملف</h3>
        <p className="text-[11px] text-muted mb-2">
          يقرأ ملف Excel متعدد الأوراق، ويتجاهل تلقائيًا أقسام الهواتف المحمولة وورقة
          TEST.
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

        {stats && (
          <div className="mt-3 text-[11px] text-muted">
            الأوراق: {stats.sheets.join(" | ")} • الإجمالي: {stats.total} • بعد فلترة
            الهواتف: {stats.after_mobile_filter} • مكررات HOT: {stats.hot_duplicates}
          </div>
        )}
      </div>

      {rawRows && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <h3 className="font-bold text-sm mb-2">المرحلة 2 - التصنيف بالذكاء</h3>
          <p className="text-[11px] text-muted mb-2">
            يتم تحديد النوع، الفئة الفرعية، الأسماء، والمواصفات الأساسية لكل صف.
          </p>

          <div className="flex gap-3 items-center mb-2 flex-wrap">
            <button
              type="button"
              onClick={doClassify}
              disabled={classifying}
              className="btn-primary disabled:opacity-50"
            >
              {classifying ? "جاري التصنيف..." : "صنّف بالذكاء"}
            </button>
          </div>
        </div>
      )}

      {safeClassified && counts && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <h3 className="font-bold text-sm mb-2">المرحلة 3 - المعاينة والإدراج</h3>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
            <Stat label="تلفزيون" value={counts.tv} />
            <Stat label="حاسوب" value={counts.computer} />
            <Stat label="جهاز لوحي" value={counts.tablet} />
            <Stat label="شبكات" value={counts.network} />
            <Stat label="جهاز منزلي" value={counts.appliance} />
            <Stat label="متخطى" value={counts.skipped} red />
          </div>

          <button
            type="button"
            onClick={doInsert}
            disabled={inserting}
            className="btn-primary disabled:opacity-50 mb-3"
          >
            {inserting ? "جاري الإدراج..." : `أدرج ${insertableCount} صف`}
          </button>

          {insertResult && (
            <div className="bg-state-success/10 border border-state-success/30 rounded-xl p-3 mb-3 text-state-success text-sm">
              تم إدراج {insertResult.inserted} منتج، بعد تجميع {insertResult.total_groups} مجموعة.
              {insertResult.errors.length > 0 && (
                <div className="mt-1 text-state-error text-xs">
                  أخطاء: {insertResult.errors.join(", ")}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="w-full text-[11px] text-right">
              <thead className="sticky top-0 bg-surface-card text-muted">
                <tr>
                  <th className="p-1.5">تخطي</th>
                  <th className="p-1.5">النوع</th>
                  <th className="p-1.5">العلامة</th>
                  <th className="p-1.5">الاسم العربي</th>
                  <th className="p-1.5">الموديل</th>
                  <th className="p-1.5">النقد</th>
                  <th className="p-1.5">الشهري</th>
                  <th className="p-1.5">المخزون</th>
                  <th className="p-1.5">سبب التخطي</th>
                </tr>
              </thead>

              <tbody>
                {safeClassified.map((row, i) => (
                  <tr
                    key={`${row.barcode || row.model || i}-${i}`}
                    className="border-t border-surface-border"
                    style={{ opacity: row.skip ? 0.45 : 1 }}
                  >
                    <td className="p-1.5">
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={() => toggleSkip(i)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-1.5">{TYPE_LABEL[row.type] || row.type}</td>
                    <td className="p-1.5">{row.brand}</td>
                    <td className="p-1.5">
                      <input
                        className="bg-transparent border-b border-transparent hover:border-surface-border focus:border-brand outline-none w-full"
                        value={row.name_ar}
                        onChange={(e) => updateRowField(i, "name_ar", e.target.value)}
                      />
                    </td>
                    <td className="p-1.5 font-mono text-[10px]" dir="ltr">
                      {row.model || row.barcode}
                    </td>
                    <td className="p-1.5">₪{toSafeNumber(row.cash).toLocaleString()}</td>
                    <td className="p-1.5 text-purple-300">
                      {toSafeNumber(row.monthly) > 0
                        ? `₪${toSafeNumber(row.monthly).toLocaleString()} × 36`
                        : "—"}
                    </td>
                    <td className="p-1.5">
                      {toSafeNumber(row.stock) === 999 ? (
                        <span className="text-state-info">بالطلب</span>
                      ) : (
                        toSafeNumber(row.stock)
                      )}
                    </td>
                    <td className="p-1.5 text-state-warning text-[10px]">
                      {row.skip_reason || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

function Stat({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div
      className="rounded-xl p-2 text-center"
      style={{
        background: red ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
        border: red
          ? "1px solid rgba(239,68,68,0.2)"
          : "1px solid rgba(16,185,129,0.2)",
      }}
    >
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className="font-bold text-lg"
        style={{ color: red ? "#ef4444" : "#10b981" }}
      >
        {value}
      </div>
    </div>
  );
}
