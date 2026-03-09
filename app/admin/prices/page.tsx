"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader } from "@/components/admin/shared";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PdfRow = {
  deviceName: string;
  storage: string;
  priceRaw: number;
  priceWithVat: number;
};

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

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[,\u060C\s]/g, "").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 50 ? null : num;
}

function extractStorage(text: string): string {
  const gb = text.match(/(\d{2,4})\s*(?:GB|gb)/i);
  if (gb) return `${parseInt(gb[1])}GB`;
  const tb = text.match(/(\d)\s*(?:TB|tb)/i);
  if (tb) return `${parseInt(tb[1])}TB`;
  return "";
}

const BRAND_EN =
  /iphone|samsung|galaxy|xiaomi|redmi|poco|oppo|vivo|huawei|honor|google|pixel|oneplus|motorola|nokia|realme|nothing|asus|sony|lg|tecno|infinix|zte|tcl/i;

const BRAND_HE =
  /\u05D0\u05D9\u05D9\u05E4\u05D5\u05DF|\u05E1\u05DE\u05E1\u05D5\u05E0\u05D2|\u05D2\u05DC\u05E7\u05E1\u05D9|\u05E9\u05D9\u05D0\u05D5\u05DE\u05D9|\u05E8\u05D3\u05DE\u05D9|\u05E4\u05D5\u05E7\u05D5|\u05D0\u05D5\u05E4\u05D5|\u05D5\u05D9\u05D5\u05D5|\u05D5\u05D5\u05D0\u05D5\u05D5\u05D9|\u05D4\u05D5\u05E0\u05D5\u05E8|\u05D2\u05D5\u05D2\u05DC|\u05E4\u05D9\u05E7\u05E1\u05DC|\u05E0\u05D5\u05E7\u05D9\u05D4|\u05E8\u05D9\u05D0\u05DC\u05DE\u05D9|\u05DE\u05D5\u05D8\u05D5\u05E8\u05D5\u05DC\u05D4/;

const SKIP_ROW =
  /\u05E1\u05D4"\u05DB|\u05E1\u05D4\u05DB|\u05DE\u05D7\u05D9\u05E8\u05D5\u05DF|\u05D3\u05D2\u05DD \u05DE\u05DB\u05E9\u05D9\u05E8|\u05EA\u05E9\u05DC\u05D5\u05DE\u05D9\u05DD|\u05E8\u05D5\u05D5\u05D7|\u05DE\u05D7\u05D9\u05E8 \u05D7\u05D5\u05D3\u05E9\u05D9|\u05E2\u05DE\u05D5\u05D3|page|\u05D4\u05E2\u05E8\u05D5\u05EA|\u05DC\u05D0 \u05DB\u05D5\u05DC\u05DC|\u05DB\u05D5\u05DC\u05DC \u05DE\u05E2|\u05DE\u05E2"\u05DE|\u05EA\u05D0\u05E8\u05D9\u05DA|\u05E6\u05D9\u05D5\u05D3 \u05E7\u05E6\u05D4|\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05E2\u05E1\u05E7\u05D9\u05D9\u05DD/i;

function hasDeviceBrand(text: string): boolean {
  return BRAND_EN.test(text) || BRAND_HE.test(text);
}

async function parsePdfFile(file: File): Promise<PdfRow[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  type Item = { text: string; x: number; y: number; w: number };
  const all: Item[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const t = (it as any).transform as number[];
      all.push({
        text: it.str.trim(),
        x: t[4],
        y: Math.round(t[5]),
        w: (it as any).width ?? 0,
      });
    }
  }

  if (all.length === 0) return [];

  all.sort((a, b) => b.y - a.y);
  const rows: Item[][] = [];
  let curRow: Item[] = [];
  let curY = all[0].y;

  for (const it of all) {
    if (Math.abs(it.y - curY) <= 4) {
      curRow.push(it);
    } else {
      if (curRow.length) rows.push(curRow);
      curRow = [it];
      curY = it.y;
    }
  }
  if (curRow.length) rows.push(curRow);

  for (const r of rows) r.sort((a, b) => a.x - b.x);

  const results: PdfRow[] = [];

  for (const row of rows) {
    const fullText = row.map((i) => i.text).join(" ");

    if (SKIP_ROW.test(fullText)) continue;
    if (!hasDeviceBrand(fullText)) continue;

    const nums: { x: number; val: number }[] = [];
    const textParts: string[] = [];

    for (const it of row) {
      const val = parsePrice(it.text);
      if (val !== null && val >= 100) {
        nums.push({ x: it.x, val });
      }
      if (!/^[\d,.\s%]+$/.test(it.text) && it.text.length >= 2) {
        textParts.push(it.text);
      }
    }

    if (nums.length === 0) continue;

    const deviceName = textParts.join(" ").replace(/\s+/g, " ").trim();
    if (deviceName.length < 4) continue;

    const storage = extractStorage(fullText);

    nums.sort((a, b) => a.x - b.x);
    const price = nums[0].val;
    const priceWithVat = Math.round(price * 1.18);

    results.push({ deviceName, storage, priceRaw: price, priceWithVat });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
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
  const [pdfRows, setPdfRows] = useState<PdfRow[]>([]);
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
        show("\u064A\u0631\u062C\u0649 \u0631\u0641\u0639 \u0645\u0644\u0641 PDF", "error");
        return;
      }
      setFileName(file.name);
      setParsing(true);

      try {
        const rows = await parsePdfFile(file);
        if (rows.length === 0) {
          show("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0633\u0639\u0627\u0631 \u0641\u064A \u0627\u0644\u0645\u0644\u0641", "error");
          setParsing(false);
          return;
        }
        setPdfRows(rows);
        show(`\u062A\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C ${rows.length} \u062C\u0647\u0627\u0632 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641`, "success");

        setMatching(true);
        const res = await fetch("/api/admin/prices/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
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
        show(`\u062E\u0637\u0623: ${err.message}`, "error");
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
      show("\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u062D\u062F\u064A\u062B\u0627\u062A \u0644\u0644\u062A\u0637\u0628\u064A\u0642", "error");
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
      show(`\u062A\u0645 \u062A\u062D\u062F\u064A\u062B ${json.updated} \u0633\u0639\u0631 \u0628\u0646\u062C\u0627\u062D`, "success");
    } catch (err: any) {
      show(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062A\u062D\u062F\u064A\u062B: ${err.message}`, "error");
    } finally {
      setApplying(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setPdfRows([]);
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
      <PageHeader title="\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0645\u0646 \u0645\u0644\u0641 PDF" />

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
                  {parsing ? "\u062C\u0627\u0631\u064A \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0644\u0641..." : "\u062C\u0627\u0631\u064A \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0623\u062C\u0647\u0632\u0629..."}
                </p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">{"\uD83D\uDCC4"}</div>
                <p className="font-bold text-lg mb-2">
                  {"\u0627\u0633\u062D\u0628 \u0645\u0644\u0641 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0647\u0646\u0627 \u0623\u0648 \u0627\u0636\u063A\u0637 \u0644\u0644\u0627\u062E\u062A\u064A\u0627\u0631"}
                </p>
                <p className="text-muted text-sm">
                  {"\u0645\u0644\u0641 PDF \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u2014 \u0633\u064A\u062A\u0645 \u0627\u062D\u062A\u0633\u0627\u0628 \u0636\u0631\u064A\u0628\u0629 18% \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B"}
                </p>
                <div className="mt-6 flex items-center justify-center gap-6 text-muted text-xs">
                  <span>{"\uD83D\uDCCA"} {"\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0639\u0645\u0648\u062F 1-18 \u062F\u0641\u0639\u0629"}</span>
                  <span>{"\uD83D\uDCB0"} +18% {"\u0636\u0631\u064A\u0628\u0629"}</span>
                  <span>{"\uD83D\uDD17"} {"\u0645\u0637\u0627\u0628\u0642\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629"}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 card p-5">
            <h3 className="font-bold mb-3 text-sm">{"\u0643\u064A\u0641 \u064A\u0639\u0645\u0644\u061F"}</h3>
            <ol className="text-muted text-xs space-y-2 list-decimal list-inside">
              <li>{"\u0627\u0631\u0641\u0639 \u0645\u0644\u0641 PDF \u0627\u0644\u0645\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 (\u0628\u062F\u0648\u0646 \u0636\u0631\u064A\u0628\u0629)"}</li>
              <li>{"\u0627\u0644\u0646\u0638\u0627\u0645 \u064A\u0633\u062A\u062E\u0631\u062C \u0639\u0645\u0648\u062F \u0627\u0644\u0623\u0633\u0639\u0627\u0631 (1-18 \u062F\u0641\u0639\u0629) \u0645\u0646 \u0627\u0644\u062C\u062F\u0648\u0644"}</li>
              <li>{"\u064A\u0636\u064A\u0641 \u0636\u0631\u064A\u0628\u0629 18% \u0639\u0644\u0649 \u0643\u0644 \u0633\u0639\u0631"}</li>
              <li>{"\u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0645\u0639 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0641\u064A \u0627\u0644\u0645\u062A\u062C\u0631"}</li>
              <li>{"\u062A\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u062A\u0624\u0643\u062F \u0627\u0644\u062A\u062D\u062F\u064A\u062B"}</li>
            </ol>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              <SumCard label={"\u0627\u0644\u0645\u062C\u0645\u0648\u0639"} value={summary.total} color="#a1a1aa" />
              <SumCard label={"\u062A\u0637\u0627\u0628\u0642 \u062A\u0627\u0645"} value={summary.exact} color="#22c55e" />
              <SumCard label={"\u062A\u0637\u0627\u0628\u0642 \u062C\u0632\u0626\u064A"} value={summary.fuzzy} color="#f59e0b" />
              <SumCard label={"\u0628\u062F\u0648\u0646 \u062A\u0637\u0627\u0628\u0642"} value={summary.unmatched} color="#ef4444" />
              <SumCard label={"\u0645\u062D\u062F\u062F \u0644\u0644\u062A\u062D\u062F\u064A\u062B"} value={selected.size} color="#c41040" />
            </div>
          )}

          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="text-muted text-xs">
              {"\uD83D\uDCC4"} {fileName} {"\u2014"} {pdfRows.length} {"\u062C\u0647\u0627\u0632"}
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="btn-outline text-xs px-4 py-2">
                {"\u0645\u0644\u0641 \u062C\u062F\u064A\u062F"}
              </button>
              <button onClick={toggleAll} className="btn-outline text-xs px-4 py-2">
                {selected.size === results.filter((r) => r.matched).length
                  ? "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0643\u0644"
                  : "\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0643\u0644"}
              </button>
              <button
                onClick={handleApply}
                disabled={applying || selected.size === 0}
                className="btn-primary text-xs px-5 py-2 disabled:opacity-40"
              >
                {applying ? "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u062F\u064A\u062B..." : `\u062A\u062D\u062F\u064A\u062B ${selected.size} \u0633\u0639\u0631`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-right" style={{ fontSize: fs }}>
              <thead>
                <tr className="bg-surface-card border-b border-surface-border">
                  <th className="p-2.5 w-8"></th>
                  <th className="p-2.5 font-bold text-muted">{"\u0627\u0644\u062C\u0647\u0627\u0632 (PDF)"}</th>
                  <th className="p-2.5 font-bold text-muted">{"\u0627\u0644\u0633\u0639\u0629"}</th>
                  <th className="p-2.5 font-bold text-muted">
                    {"\u0633\u0639\u0631 PDF"}
                    <span className="text-[10px] block text-dim">{"\u0628\u062F\u0648\u0646 \u0636\u0631\u064A\u0628\u0629"}</span>
                  </th>
                  <th className="p-2.5 font-bold text-muted">
                    {"\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062C\u062F\u064A\u062F"}
                    <span className="text-[10px] block text-dim">+18% {"\u0636\u0631\u064A\u0628\u0629"}</span>
                  </th>
                  <th className="p-2.5 font-bold text-muted">{"\u0627\u0644\u0645\u0646\u062A\u062C \u0627\u0644\u0645\u0637\u0627\u0628\u0642"}</th>
                  <th className="p-2.5 font-bold text-muted">{"\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062D\u0627\u0644\u064A"}</th>
                  <th className="p-2.5 font-bold text-muted">{"\u0627\u0644\u0641\u0631\u0642"}</th>
                  <th className="p-2.5 font-bold text-muted">{"\u0627\u0644\u062D\u0627\u0644\u0629"}</th>
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
                          {r.pdfStorage || "\u2014"}
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
                          <span className="text-dim">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-muted">
                        {r.currentPrice != null
                          ? r.currentPrice.toLocaleString()
                          : "\u2014"}
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
                          "\u2014"
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
              {"\u0625\u0644\u063A\u0627\u0621"}
            </button>
            <button
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="btn-primary px-6 py-2.5 disabled:opacity-40"
            >
              {applying
                ? "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u062F\u064A\u062B..."
                : `\u062A\u0623\u0643\u064A\u062F \u062A\u062D\u062F\u064A\u062B ${selected.size} \u0633\u0639\u0631`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && applyResult && (
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-6xl mb-4">
            {applyResult.failed === 0 ? "\u2705" : "\u26A0\uFE0F"}
          </div>
          <h2 className="font-black text-xl mb-2">{"\u062A\u0645 \u0627\u0644\u062A\u062D\u062F\u064A\u062B"}</h2>
          <p className="text-muted text-sm mb-6">
            {"\u062A\u0645 \u062A\u062D\u062F\u064A\u062B"}{" "}
            <span className="text-green-400 font-bold">
              {applyResult.updated}
            </span>{" "}
            {"\u0633\u0639\u0631 \u0628\u0646\u062C\u0627\u062D"}
            {applyResult.failed > 0 && (
              <>
                {" \u2014 \u0641\u0634\u0644 "}
                <span className="text-red-400 font-bold">
                  {applyResult.failed}
                </span>
              </>
            )}
          </p>
          <button onClick={reset} className="btn-primary px-8 py-3">
            {"\u0631\u0641\u0639 \u0645\u0644\u0641 \u062C\u062F\u064A\u062F"}
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
    exact: { bg: "bg-green-500/20", text: "text-green-400", label: "\u062A\u0627\u0645" },
    fuzzy: { bg: "bg-amber-500/20", text: "text-amber-400", label: "\u062C\u0632\u0626\u064A" },
    none: { bg: "bg-red-500/20", text: "text-red-400", label: "\u0644\u0627 \u064A\u0648\u062C\u062F" },
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
