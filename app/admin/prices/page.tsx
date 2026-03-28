"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader, ToastContainer } from "@/components/admin/shared";
import { csrfHeaders } from "@/lib/csrf-client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MatchResult = {
  pdfDeviceName: string;
  pdfStorage: string;
  pdfBrand?: string;
  pdfPriceRaw: number;
  priceWithVat: number;
  monthlyPrice: number;
  matched: boolean;
  confidence: "exact" | "fuzzy" | "none";
  productId: string | null;
  productNameAr: string | null;
  productNameHe: string | null;
  variantStorage: string | null;
  currentPrice: number | null;
  currentMonthly: number | null;
  newPrice: number;
  matchScore: number;
};

/** Strip storage suffix (e.g. "256GB", "512GB") to get base device name */
function _baseDeviceName(name: string): string {
  return name.replace(/\s*(?:128|256|512|64|32|1)\s*(?:GB|TB)\s*$/i, "").trim() || name;
}

type Summary = {
  total: number;
  matched: number;
  exact: number;
  fuzzy: number;
  unmatched: number;
};

/* ------------------------------------------------------------------ */
/*  File Parsing Helpers                                               */
/* ------------------------------------------------------------------ */

function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
}

function isSupportedPriceFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || isSpreadsheetFile(file);
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  const items: { text: string; x: number; y: number }[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const tc = await pg.getTextContent();
    for (const it of tc.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const t = (it as any).transform as number[];
      items.push({ text: it.str.trim(), x: t[4], y: Math.round(t[5]) });
    }
  }

  if (items.length === 0) return "";

  items.sort((a, b) => b.y - a.y);
  const rows: { text: string; x: number; y: number }[][] = [];
  let curRow: { text: string; x: number; y: number }[] = [];
  let curY = items[0].y;

  for (const it of items) {
    if (Math.abs(it.y - curY) <= 4) {
      curRow.push(it);
    } else {
      if (curRow.length) rows.push(curRow);
      curRow = [it];
      curY = it.y;
    }
  }
  if (curRow.length) rows.push(curRow);

  return rows
    .map((r) => r.sort((a, b) => a.x - b.x).map((i) => i.text).join(" | "))
    .join("\n");
}

/** Structured row for match-direct API (no AI, local matching) */
type DirectMatchRow = {
  brand: string;
  model: string;
  storage?: string;
  price: number;
  monthlyPrice: number;
};

/** Detect column indices from header row. Columns: #, Brand, Model, Cash price (1-18 payments), Monthly payment (36 months) */
function detectColumnIndices(headers: string[]): {
  brand: number;
  model: number;
  cashPrice: number;
  monthlyPrice: number;
} {
  const norm = (s: string) => String(s ?? "").toLowerCase().trim();
  let brandIdx = -1;
  let modelIdx = -1;
  let cashPriceIdx = -1;
  let monthlyPriceIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (h.includes("brand") && brandIdx < 0) brandIdx = i;
    if (h.includes("model") && modelIdx < 0) modelIdx = i;
    if (
      (h.includes("cash") && h.includes("price")) ||
      h.includes("1-18") ||
      h.includes("מחיר") ||
      h.includes("سعر")
    ) {
      if (cashPriceIdx < 0) cashPriceIdx = i;
    }
    if (
      (h.includes("monthly") && h.includes("payment")) ||
      h.includes("36") ||
      h.includes("חודש") ||
      h.includes("قسط")
    ) {
      if (monthlyPriceIdx < 0) monthlyPriceIdx = i;
    }
  }
  return { brand: brandIdx, model: modelIdx, cashPrice: cashPriceIdx, monthlyPrice: monthlyPriceIdx };
}

function parsePrice(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const s = String(val ?? "").replace(/[₪$€,\s]/g, "").replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Parse Excel/CSV to structured rows for match-direct API */
async function parseSpreadsheetToRows(file: File): Promise<DirectMatchRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  let workbook: import("xlsx").WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "array", cellDates: false });
  } catch (e: any) {
    throw new Error("فشل قراءة الملف: " + (e?.message || "تأكد أن الملف Excel أو CSV صالح"));
  }
  const sheetNames = workbook.SheetNames.filter(Boolean);
  if (!sheetNames.length) throw new Error("الملف لا يحتوي على أوراق بيانات");

  const firstSheetName = sheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error("ورقة البيانات فارغة");

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: "",
  });

  if (!rows.length) throw new Error("الجدول فارغ");

  const headerRow = rows[0].map((c) => String(c ?? "").trim());
  const { brand, model, cashPrice, monthlyPrice } = detectColumnIndices(headerRow);

  if (brand < 0 || model < 0 || cashPrice < 0) {
    throw new Error(
      "لم يتم العثور على الأعمدة المطلوبة. تأكد من وجود: Brand, Model, Cash price (1-18 payments)"
    );
  }

  const result: DirectMatchRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as (string | number | boolean | null)[];
    const brandVal = String(row[brand] ?? "").trim();
    const modelVal = String(row[model] ?? "").trim();
    const priceVal = parsePrice(cashPrice >= 0 ? row[cashPrice] : 0);
    const monthlyVal = monthlyPrice >= 0 ? parsePrice(row[monthlyPrice]) : 0;

    if (!modelVal || priceVal <= 0) continue;

    result.push({
      brand: brandVal || "Other",
      model: modelVal,
      price: priceVal,
      monthlyPrice: monthlyVal,
    });
  }

  if (!result.length) {
    throw new Error("لم يتم استخراج أي صفوف صالحة — تأكد من وجود بيانات في الأعمدة");
  }
  return result;
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  let workbook: import("xlsx").WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "array", cellDates: false });
  } catch (e: any) {
    throw new Error("فشل قراءة الملف: " + (e?.message || "تأكد أن الملف Excel أو CSV صالح"));
  }
  const sheetNames = workbook.SheetNames.filter(Boolean);
  if (!sheetNames.length) throw new Error("الملف لا يحتوي على أوراق بيانات");

  const firstSheetName = sheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error("ورقة البيانات فارغة");

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: "",
  });

  const text = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "").replace(/\s+/g, " ").trim();
          return s.replace(/[₪$€]/g, "").trim() || s;
        })
        .filter(Boolean)
        .join(" | ")
    )
    .filter(Boolean)
    .join("\n");

  if (!text || text.length < 30) {
    throw new Error("لم يتم استخراج بيانات كافية من الملف — تأكد أن الجدول يحتوي أعمدة: Brand, Model, السعر، القسط الشهري");
  }
  return text;
}

async function extractFileText(file: File): Promise<string> {
  return isSpreadsheetFile(file) ? extractSpreadsheetText(file) : extractPdfText(file);
}

/* ------------------------------------------------------------------ */

export default function PricesPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsing, setParsing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applyResult, setApplyResult] = useState<{
    updated: number;
    created: number;
    failed: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedPriceFile(file)) {
        show("يرجى رفع ملف Excel أو CSV أو PDF", "error");
        return;
      }
      setFileName(file.name);
      setParsing(true);
      setErrorMsg(null);

      try {
        const isSpreadsheet = isSpreadsheetFile(file);
        let json: { data: MatchResult[]; summary: Summary; error?: string; steps?: string[] };

        if (isSpreadsheet) {
          const rows = await parseSpreadsheetToRows(file);
          show("تم استخراج البيانات، جاري المطابقة المباشرة...", "success");
          setMatching(true);
          const res = await fetch("/api/admin/prices/match-direct", {
            method: "POST",
            headers: csrfHeaders(),
            body: JSON.stringify({ rows }),
          });
          json = await res.json();
        } else {
          const extractedText = await extractFileText(file);
          if (!extractedText) {
            show("لم يتم العثور على نص في الملف", "error");
            setParsing(false);
            return;
          }
          show("تم استخراج البيانات، جاري التحليل والمطابقة...", "success");
          setMatching(true);
          const res = await fetch("/api/admin/prices/match", {
            method: "POST",
            headers: csrfHeaders(),
            body: JSON.stringify({ pdfText: extractedText }),
          });
          json = await res.json();
        }

        if (json.error) {
          console.error("Match API error:", json);
          throw new Error(json.error + (json.steps ? " [" + json.steps.join(" > ") + "]" : ""));
        }

        setResults(json.data);
        setSummary(json.summary);

        const matchedIdx = new Set<number>();
        (json.data as MatchResult[]).forEach((r, i) => {
          if (r.matched) matchedIdx.add(i);
        });
        setSelected(matchedIdx);

        setStep("preview");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        show("حدث خطأ — راجع التفاصيل أدناه", "error");
        console.error("PRICE MATCH ERROR:", msg);
      } finally {
        setParsing(false);
        setMatching(false);
      }
    },
    [show]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleApply = async () => {
    const updates = results
      .filter((_, i) => selected.has(i))
      .filter((r) => r.matched && r.productId && r.variantStorage)
      .map((r) => ({
        productId: r.productId!,
        variantStorage: r.variantStorage!,
        newPrice: r.newPrice,
        ...(r.monthlyPrice ? { monthlyPrice: r.monthlyPrice } : {}),
      }));

    const selectedUnmatched = results
      .filter((_, i) => selected.has(i))
      .filter((r) => !r.matched);

    const creates = selectedUnmatched.map((r) => ({
      pdfDeviceName: r.pdfDeviceName,
      pdfStorage: r.pdfStorage,
      pdfBrand: r.pdfBrand || "Other",
      newPrice: r.newPrice,
      ...(r.monthlyPrice ? { monthlyPrice: r.monthlyPrice } : {}),
    }));

    if (updates.length === 0 && creates.length === 0) {
      show("لا توجد تحديثات أو إنشاءات للتطبيق", "error");
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/admin/prices/apply", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ updates, creates }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setApplyResult({
        updated: json.updated ?? 0,
        created: json.created ?? 0,
        failed: json.failed ?? 0,
      });
      setStep("done");
      const parts: string[] = [];
      if (json.updated > 0) parts.push(`تم تحديث ${json.updated} سعر`);
      if (json.created > 0) parts.push(`إنشاء ${json.created} منتج جديد`);
      show(parts.length ? parts.join(" — ") + " بنجاح" : "تم", "success");
    } catch (err: unknown) {
      show(`خطأ في التحديث: ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    } finally {
      setApplying(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setResults([]);
    setSummary(null);
    setSelected(new Set());
    setApplyResult(null);
    setFileName("");
    setErrorMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      const all = new Set<number>();
      results.forEach((_, i) => all.add(i));
      setSelected(all);
    }
  };

  const toggleOne = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const pad = scr.mobile ? 12 : 24;
  const fs = scr.mobile ? 11 : 13;

  return (
    <div style={{ padding: pad }}>
      <PageHeader title="تحديث الأسعار من ملف" />

      <ToastContainer toasts={toasts} />

      {step === "upload" && (
        <div className="max-w-2xl mx-auto">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-brand bg-brand/10 scale-[1.02]"
                : "border-surface-border hover:border-brand/50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={onFileInput}
            />
            {parsing || matching ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-muted text-sm">
                  {parsing
                    ? "جاري استخراج النص من الملف..."
                    : isSpreadsheetFile({ name: fileName } as File)
                    ? "🔗 مطابقة مباشرة (بدون AI)..."
                    : "🧠 الذكاء الاصطناعي يحلل ويطابق الأجهزة..."}
                </p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">📄</div>
                <p className="font-bold text-lg mb-2">
                  {"اسحب ملف الأسعار هنا أو اضغط للاختيار"}
                </p>
                <p className="text-muted text-sm">
                  {"يدعم Excel و CSV و PDF — سيتم احتساب ضريبة 18% تلقائياً"}
                </p>
                <div className="mt-6 flex items-center justify-center gap-6 text-muted text-xs flex-wrap">
                  <span>📊 عمود 1-18 دفعة</span>
                  <span>📅 عمود قسط ×36</span>
                  <span>💰 +18% ضريبة</span>
                  <span>🔗 مطابقة تلقائية</span>
                </div>
              </>
            )}
          </div>


          {errorMsg && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-400 font-bold text-sm">خطأ في التحليل</span>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-300 text-xs">×</button>
              </div>
              <pre className="text-red-300 text-xs whitespace-pre-wrap break-all font-mono" dir="ltr">{errorMsg}</pre>
            </div>
          )}
          <div className="mt-6 card p-5">
            <h3 className="font-bold mb-3 text-sm">{"كيف يعمل؟"}</h3>
            <ol className="text-muted text-xs space-y-2 list-decimal list-inside">
              <li>{"ارفع ملف Excel أو CSV أو PDF المحتوي على جدول الأسعار (بدون ضريبة)"}</li>
              <li className="text-amber-400">{"إذا كان Excel يظهر «Protected View»: اضغط Enable Editing أو احفظ الملف أولاً (Save As) ثم ارفعه"}</li>
              <li>{"النظام يستخرج عمود الأسعار (1-18 دفعة) + عمود القسط الشهري (36 دفعة)"}</li>
              <li>{"يضيف ضريبة 18% على كل سعر"}</li>
              <li>{"يطابق الأجهزة تلقائياً مع المنتجات في المتجر"}</li>
              <li>{"تراجع المعاينة وتؤكد التحديث — يُحدّث السعر + القسط الشهري"}</li>
            </ol>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              <SumCard label={"المجموع"} value={summary.total} color="#a1a1aa" />
              <SumCard label={"تطابق تام"} value={summary.exact} color="#22c55e" />
              <SumCard label={"تطابق جزئي"} value={summary.fuzzy} color="#f59e0b" />
              <SumCard label={"بدون تطابق"} value={summary.unmatched} color="#ef4444" />
              <SumCard label={"محدد للتحديث"} value={selected.size} color="#c41040" />
            </div>
          )}

          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="text-muted text-xs">
              📄 {fileName} {"—"} {results.length} {"جهاز"}
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="btn-outline text-xs px-4 py-2">
                {"ملف جديد"}
              </button>
              <button onClick={toggleAll} className="btn-outline text-xs px-4 py-2">
                {selected.size === results.length
                  ? "إلغاء الكل"
                  : "تحديد الكل"}
              </button>
              <button
                onClick={handleApply}
                disabled={applying || selected.size === 0}
                className="btn-primary text-xs px-5 py-2 disabled:opacity-40"
              >
                {applying ? "جاري التحديث..." : `تحديث ${selected.size} سعر`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-right" style={{ fontSize: fs }}>
              <thead>
                <tr className="bg-surface-card border-b border-surface-border">
                  <th className="p-2.5 w-8"></th>
                  <th className="p-2.5 font-bold text-muted">{"الجهاز (الملف)"}</th>
                  <th className="p-2.5 font-bold text-muted">{"السعة"}</th>
                  <th className="p-2.5 font-bold text-muted">
                    {"سعر الملف"}
                    <span className="text-[10px] block text-dim">{"بدون ضريبة"}</span>
                  </th>
                  <th className="p-2.5 font-bold text-muted">
                    {"السعر الجديد"}
                    <span className="text-[10px] block text-dim">+18% {"ضريبة"}</span>
                  </th>
                  <th className="p-2.5 font-bold text-muted">
                    {"قسط ×36"}
                    <span className="text-[10px] block text-dim">{"شهري"}</span>
                  </th>
                  <th className="p-2.5 font-bold text-muted">{"المنتج المطابق"}</th>
                  <th className="p-2.5 font-bold text-muted">{"السعر الحالي"}</th>
                  <th className="p-2.5 font-bold text-muted">{"الفرق"}</th>
                  <th className="p-2.5 font-bold text-muted">{"الحالة"}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const diff =
                    r.currentPrice != null ? r.newPrice - r.currentPrice : null;
                  const isSelected = selected.has(i);
                  return (
                    <tr
                      key={i}
                      className={`border-b border-surface-border/50 transition-colors ${
                        isSelected
                          ? "bg-brand/5"
                          : "hover:bg-surface-card/50"
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(i)}
                          className="accent-brand w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-medium max-w-[200px] truncate">
                        {r.pdfDeviceName}
                      </td>
                      <td className="p-2.5">
                        <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs">
                          {r.pdfStorage || "—"}
                        </span>
                      </td>
                      <td className="p-2.5 text-muted">
                        {r.pdfPriceRaw.toLocaleString()}
                      </td>
                      <td className="p-2.5 font-bold text-brand">
                        {r.priceWithVat.toLocaleString()}
                      </td>
                      <td className="p-2.5">
                        {r.monthlyPrice ? (
                          <span className="font-bold text-purple-400">
                            ₪{r.monthlyPrice.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                      <td className="p-2.5 max-w-[180px] truncate">
                        {r.productNameAr ? (
                          <span title={r.productNameHe || ""}>
                            {r.productNameAr}
                            {r.variantStorage && (
                              <span className="text-muted text-[10px] mr-1">
                                ({r.variantStorage})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-dim">{"—"}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-muted">
                        {r.currentPrice != null
                          ? r.currentPrice.toLocaleString()
                          : "—"}
                      </td>
                      <td className="p-2.5">
                        {diff != null ? (
                          <span
                            className={`font-bold ${
                              diff > 0
                                ? "text-red-400"
                                : diff < 0
                                ? "text-green-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toLocaleString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2.5">
                        {!r.matched ? (
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            إنشاء منتج جديد
                          </span>
                        ) : (
                          <ConfidenceBadge confidence={r.confidence} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={reset} className="btn-outline text-xs px-4 py-2">
              {"إلغاء"}
            </button>
            <button
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="btn-primary px-6 py-2.5 disabled:opacity-40"
            >
              {applying
                ? "جاري التحديث..."
                : `تأكيد تحديث ${selected.size} سعر`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && applyResult && (
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-6xl mb-4">
            {applyResult.failed === 0 ? "✅" : "⚠️"}
          </div>
          <h2 className="font-black text-xl mb-2">{"تم التحديث"}</h2>
          <p className="text-muted text-sm mb-6">
            {applyResult.updated > 0 && (
              <>
                {"تم تحديث "}
                <span className="text-green-400 font-bold">{applyResult.updated}</span>
                {" سعر بنجاح"}
              </>
            )}
            {applyResult.created > 0 && (
              <>
                {applyResult.updated > 0 && " — "}
                {"إنشاء "}
                <span className="text-emerald-400 font-bold">{applyResult.created}</span>
                {" منتج جديد"}
              </>
            )}
            {applyResult.failed > 0 && (
              <>
                {" — فشل "}
                <span className="text-red-400 font-bold">
                  {applyResult.failed}
                </span>
              </>
            )}
          </p>
          <button onClick={reset} className="btn-primary px-8 py-3">
            {"رفع ملف جديد"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SumCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] text-muted mb-1">{label}</div>
      <div className="font-black text-2xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: "exact" | "fuzzy" | "none";
}) {
  const map = {
    exact: { bg: "bg-green-500/20", text: "text-green-400", label: "تام" },
    fuzzy: { bg: "bg-amber-500/20", text: "text-amber-400", label: "جزئي" },
    none: { bg: "bg-red-500/20", text: "text-red-400", label: "لا يوجد" },
  };
  const s = map[confidence];
  return (
    <span
      className={`${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[10px] font-bold`}
    >
      {s.label}
    </span>
  );
}
