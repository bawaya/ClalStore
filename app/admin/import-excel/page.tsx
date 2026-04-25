"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useToast } from "@/lib/hooks";
import { PageHeader, ToastContainer } from "@/components/admin/shared";
import { csrfHeaders, getCsrfToken } from "@/lib/csrf-client";

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

const TYPE_LABEL: Record<string, string> = {
  tv: "📺 تلفزيون",
  computer: "💻 كمبيوتر",
  tablet: "📱 تابلت",
  network: "📡 شبكة",
  appliance: "🏠 جهاز ذكي",
};

export default function ImportExcelPage() {
  const { toasts, show } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);
  const [classified, setClassified] = useState<ClassifiedRow[] | null>(null);
  const [stats, setStats] = useState<{ total: number; after_mobile_filter: number; hot_duplicates: number; sheets: string[] } | null>(null);
  const [costRatio, setCostRatio] = useState(0.65);
  const [insertResult, setInsertResult] = useState<{ inserted: number; total_groups: number; errors: string[] } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setRawRows(null);
      setClassified(null);
      setInsertResult(null);
    }
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
      setRawRows(data.data.rows as RawRow[]);
      setStats(data.data.stats);
      show(`✅ تم قراءة ${data.data.rows.length} صف من الملف`);
    } catch (err) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ"}`, "error");
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
        body: JSON.stringify({ rows: rawRows, costRatio }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "فشل التصنيف");
      setClassified(data.data.classified as ClassifiedRow[]);
      show(`✅ تم تصنيف ${data.data.classified.length} منتج بالذكاء`);
    } catch (err) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ"}`, "error");
    } finally {
      setClassifying(false);
    }
  };

  const doInsert = async () => {
    if (!classified) return;
    if (!confirm(`سيتم إدراج المنتجات (${classified.filter((r) => !r.skip).length} صف بعد التجميع). متابعة؟`)) return;
    setInserting(true);
    try {
      const res = await fetch("/api/admin/import-excel?step=insert", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ rows: classified }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "فشل الإدراج");
      setInsertResult(data.data);
      show(`✅ تم إدراج ${data.data.inserted} منتج`);
    } catch (err) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ"}`, "error");
    } finally {
      setInserting(false);
    }
  };

  const toggleSkip = (idx: number) => {
    if (!classified) return;
    const next = [...classified];
    next[idx] = { ...next[idx], skip: !next[idx].skip };
    setClassified(next);
  };

  const updateRowField = (idx: number, key: keyof ClassifiedRow, value: unknown) => {
    if (!classified) return;
    const next = [...classified];
    next[idx] = { ...next[idx], [key]: value } as ClassifiedRow;
    setClassified(next);
  };

  const counts = classified
    ? classified.reduce(
        (acc, r) => {
          if (r.skip) acc.skipped++;
          else acc[r.type as keyof typeof acc] = (acc[r.type as keyof typeof acc] || 0) + 1;
          return acc;
        },
        { skipped: 0, tv: 0, computer: 0, tablet: 0, network: 0, appliance: 0 } as Record<string, number>,
      )
    : null;

  return (
    <div>
      <PageHeader title="📥 استيراد منتجات من Excel" />

      <div className="card mb-4" style={{ padding: 14 }}>
        <h3 className="font-bold text-sm mb-2">المرحلة 1 — رفع الملف</h3>
        <p className="text-[11px] text-muted mb-2">
          يقرأ ملف Excel متعدد الورقات. يتجاهل تلقائياً صفوف الموبايل (iPhone, Galaxy, Xiaomi, ZTE) وورقة TEST.
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="text-xs" />
          <button
            type="button"
            onClick={doParse}
            disabled={!file || parsing}
            className="btn-primary disabled:opacity-50"
          >
            {parsing ? "⏳ جاري القراءة..." : "📖 اقرأ الملف"}
          </button>
        </div>
        {stats && (
          <div className="mt-3 text-[11px] text-muted">
            الورقات: {stats.sheets.join(" | ")} • إجمالي: {stats.total} • بعد فلترة الموبايل: {stats.after_mobile_filter} •
            مكرّرات HOT: {stats.hot_duplicates}
          </div>
        )}
      </div>

      {rawRows && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <h3 className="font-bold text-sm mb-2">المرحلة 2 — تصنيف بالذكاء الاصطناعي (Claude)</h3>
          <p className="text-[11px] text-muted mb-2">
            يحدّد لكل منتج: النوع (تلفزيون / كمبيوتر / تابلت / شبكة / جهاز منزلي)، الفئة الفرعية، الترجمة العربية، والمواصفات.
          </p>
          <div className="flex gap-3 items-center mb-2 flex-wrap">
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted">نسبة التكلفة من النقد:</span>
              <input
                type="number"
                min={0.1}
                max={0.95}
                step={0.05}
                value={costRatio}
                onChange={(e) => setCostRatio(Number(e.target.value))}
                className="input text-xs w-20"
                dir="ltr"
              />
            </label>
            <button
              type="button"
              onClick={doClassify}
              disabled={classifying}
              className="btn-primary disabled:opacity-50"
            >
              {classifying ? "⏳ جاري التصنيف (قد يستغرق دقيقة)..." : "🤖 صنّف بالذكاء"}
            </button>
          </div>
        </div>
      )}

      {classified && counts && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <h3 className="font-bold text-sm mb-2">المرحلة 3 — معاينة وإدراج</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
            <Stat label="📺 تلفزيون" value={counts.tv} />
            <Stat label="💻 كمبيوتر" value={counts.computer} />
            <Stat label="📱 تابلت" value={counts.tablet} />
            <Stat label="📡 شبكة" value={counts.network} />
            <Stat label="🏠 جهاز ذكي" value={counts.appliance} />
            <Stat label="❌ متخطّى" value={counts.skipped} red />
          </div>

          <button
            type="button"
            onClick={doInsert}
            disabled={inserting}
            className="btn-primary disabled:opacity-50 mb-3"
          >
            {inserting ? "⏳ جاري الإدراج..." : `✅ ادرج ${classified.filter((r) => !r.skip).length} صف`}
          </button>

          {insertResult && (
            <div className="bg-state-success/10 border border-state-success/30 rounded-xl p-3 mb-3 text-state-success text-sm">
              ✅ تم إدراج {insertResult.inserted} منتج (تم تجميع {insertResult.total_groups} مجموعة).
              {insertResult.errors.length > 0 && (
                <div className="mt-1 text-state-error text-xs">أخطاء: {insertResult.errors.join(", ")}</div>
              )}
            </div>
          )}

          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="w-full text-[11px] text-right">
              <thead className="sticky top-0 bg-surface-card text-muted">
                <tr>
                  <th className="p-1.5">تخطّي</th>
                  <th className="p-1.5">النوع</th>
                  <th className="p-1.5">ماركة</th>
                  <th className="p-1.5">اسم عربي</th>
                  <th className="p-1.5">الموديل</th>
                  <th className="p-1.5">نقد ₪</th>
                  <th className="p-1.5">شهري ₪</th>
                  <th className="p-1.5">المخزون</th>
                  <th className="p-1.5">سبب التخطي</th>
                </tr>
              </thead>
              <tbody>
                {classified.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-surface-border"
                    style={{ opacity: r.skip ? 0.45 : 1 }}
                  >
                    <td className="p-1.5">
                      <input
                        type="checkbox"
                        checked={r.skip}
                        onChange={() => toggleSkip(i)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-1.5">{TYPE_LABEL[r.type] || r.type}</td>
                    <td className="p-1.5">{r.brand}</td>
                    <td className="p-1.5">
                      <input
                        className="bg-transparent border-b border-transparent hover:border-surface-border focus:border-brand outline-none w-full"
                        value={r.name_ar}
                        onChange={(e) => updateRowField(i, "name_ar", e.target.value)}
                      />
                    </td>
                    <td className="p-1.5 font-mono text-[10px]" dir="ltr">
                      {r.model || r.barcode}
                    </td>
                    <td className="p-1.5">₪{r.cash.toLocaleString()}</td>
                    <td className="p-1.5 text-purple-300">
                      {r.monthly > 0 ? `₪${r.monthly.toLocaleString()} × 36` : "—"}
                    </td>
                    <td className="p-1.5">
                      {r.stock === 999 ? <span className="text-state-info">بالطلب</span> : r.stock}
                    </td>
                    <td className="p-1.5 text-state-warning text-[10px]">{r.skip_reason || ""}</td>
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

function Stat({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div
      className="rounded-xl p-2 text-center"
      style={{
        background: red ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
        border: red ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
      }}
    >
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-bold text-lg" style={{ color: red ? "#ef4444" : "#10b981" }}>
        {value}
      </div>
    </div>
  );
}
