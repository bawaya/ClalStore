"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader } from "@/components/admin/shared";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MatchResult = {
  pdfDeviceName: string;
  pdfStorage: string;
  pdfPriceRaw: number;
  priceWithVat: number;
  matched: boolean;
  confidence: "exact" | "fuzzy" | "none";
  productId: string | null;
  productNameAr: string | null;
  productNameHe: string | null;
  variantStorage: string | null;
  currentPrice: number | null;
  newPrice: number;
  matchScore: number;
};

type Summary = {
  total: number;
  matched: number;
  exact: number;
  fuzzy: number;
  unmatched: number;
};

/* ------------------------------------------------------------------ */
/*  PDF Parsing Helpers                                                */
/* ------------------------------------------------------------------ */

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
    failed: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".pdf")) {
        show("يرجى رفع ملف PDF", "error");
        return;
      }
      setFileName(file.name);
      setParsing(true);

      try {
        const pdfText = await extractPdfText(file);
        if (!pdfText) {
          show("لم يتم العثور على نص في الملف", "error");
          setParsing(false);
          return;
        }
        show("تم استخراج النص، جاري التحليل بالذكاء الاصطناعي...", "success");

        setMatching(true);
        const res = await fetch("/api/admin/prices/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfText }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        setResults(json.data);
        setSummary(json.summary);

        const matchedIdx = new Set<number>();
        (json.data as MatchResult[]).forEach((r, i) => {
          if (r.matched) matchedIdx.add(i);
        });
        setSelected(matchedIdx);

        setStep("preview");
      } catch (err: any) {
        show(`خطأ: ${err.message}`, "error");
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
      }));

    if (updates.length === 0) {
      show("لا توجد تحديثات للتطبيق", "error");
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/admin/prices/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setApplyResult({ updated: json.updated, failed: json.failed });
      setStep("done");
      show(`تم تحديث ${json.updated} سعر بنجاح`, "success");
    } catch (err: any) {
      show(`خطأ في التحديث: ${err.message}`, "error");
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
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleAll = () => {
    if (selected.size === results.filter((r) => r.matched).length) {
      setSelected(new Set());
    } else {
      const all = new Set<number>();
      results.forEach((r, i) => {
        if (r.matched) all.add(i);
      });
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
      <PageHeader title="تحديث الأسعار من ملف PDF" />

      <div className="fixed top-4 left-4 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-xl text-sm font-bold shadow-lg animate-fadeIn ${
              t.type === "error"
                ? "bg-red-600 text-white"
                : t.type === "success"
                ? "bg-green-600 text-white"
                : "bg-zinc-700 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

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
              accept=".pdf"
              className="hidden"
              onChange={onFileInput}
            />
            {parsing || matching ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-muted text-sm">
                  {parsing ? "جاري استخراج النص من الملف..." : "🧠 الذكاء الاصطناعي يحلل ويطابق الأجهزة..."}
                </p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">📄</div>
                <p className="font-bold text-lg mb-2">
                  {"اسحب ملف الأسعار هنا أو اضغط للاختيار"}
                </p>
                <p className="text-muted text-sm">
                  {"ملف PDF يحتوي على جدول الأسعار — سيتم احتساب ضريبة 18% تلقائياً"}
                </p>
                <div className="mt-6 flex items-center justify-center gap-6 text-muted text-xs">
                  <span>📊 استخراج عمود 1-18 دفعة</span>
                  <span>💰 +18% ضريبة</span>
                  <span>🔗 مطابقة تلقائية</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 card p-5">
            <h3 className="font-bold mb-3 text-sm">{"كيف يعمل؟"}</h3>
            <ol className="text-muted text-xs space-y-2 list-decimal list-inside">
              <li>{"ارفع ملف PDF المحتوي على جدول الأسعار (بدون ضريبة)"}</li>
              <li>{"النظام يستخرج عمود الأسعار (1-18 دفعة) من الجدول"}</li>
              <li>{"يضيف ضريبة 18% على كل سعر"}</li>
              <li>{"يطابق الأجهزة تلقائياً مع المنتجات في المتجر"}</li>
              <li>{"تراجع المعاينة وتؤكد التحديث"}</li>
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
                {selected.size === results.filter((r) => r.matched).length
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
                  <th className="p-2.5 font-bold text-muted">{"الجهاز (PDF)"}</th>
                  <th className="p-2.5 font-bold text-muted">{"السعة"}</th>
                  <th className="p-2.5 font-bold text-muted">
                    {"سعر PDF"}
                    <span className="text-[10px] block text-dim">{"بدون ضريبة"}</span>
                  </th>
                  <th className="p-2.5 font-bold text-muted">
                    {"السعر الجديد"}
                    <span className="text-[10px] block text-dim">+18% {"ضريبة"}</span>
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
                          : r.matched
                          ? "hover:bg-surface-card/50"
                          : "opacity-50"
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        {r.matched && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(i)}
                            className="accent-brand w-4 h-4 cursor-pointer"
                          />
                        )}
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
                        <ConfidenceBadge confidence={r.confidence} />
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
            {"تم تحديث"}{" "}
            <span className="text-green-400 font-bold">
              {applyResult.updated}
            </span>{" "}
            {"سعر بنجاح"}
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
