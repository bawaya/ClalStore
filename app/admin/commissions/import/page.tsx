"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { ToastContainer, EmptyState } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { calcLineCommission } from "@/lib/commissions/calculator";
import { getCsrfToken } from "@/lib/csrf-client";

interface CsvRow {
  sale_date: string;
  customer_name: string;
  customer_phone: string;
  package_price: number;
  has_valid_hk: boolean;
  notes: string;
  commission: number;
  error?: string;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export default function ImportPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const downloadTemplate = () => {
    const bom = "\uFEFF";
    const csv = bom + "sale_date,customer_name,customer_phone,package_price,has_valid_hk,notes\n2026-04-01,ישראל ישראלי,050-1234567,25,true,הערה לדוגמה";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "commission-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) { show("הקובץ ריק או חסרת כותרות", "warning"); return; }

      const headers = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ""));
      const parsed: CsvRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        const obj: Record<string, string> = {};
        headers.forEach((h, j) => { obj[h] = cells[j] || ""; });

        const price = parseFloat(obj.package_price) || 0;
        const hk = obj.has_valid_hk !== "false" && obj.has_valid_hk !== "0";
        const commission = calcLineCommission(price, hk);

        let error: string | undefined;
        if (!obj.sale_date) error = "חסר תאריך";
        else if (price <= 0) error = "מחיר חבילה לא תקין";

        parsed.push({
          sale_date: obj.sale_date || "",
          customer_name: obj.customer_name || "",
          customer_phone: obj.customer_phone || "",
          package_price: price,
          has_valid_hk: hk,
          notes: obj.notes || "",
          commission,
          error,
        });
      }

      setRows(parsed);
      show(`נקראו ${parsed.length} שורות`, "info");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) { show("אין שורות תקינות לייבוא", "warning"); return; }

    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        const res = await fetch("/api/admin/commissions/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({
            sale_type: "line",
            sale_date: row.sale_date,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            package_price: row.package_price,
            has_valid_hk: row.has_valid_hk,
            notes: row.notes ? `[CSV] ${row.notes}` : "[CSV ייבוא]",
          }),
        });
        if (res.ok) success++;
        else errors++;
      } catch { errors++; }
    }

    setImportResult({ success, errors });
    setImporting(false);
    show(`יובאו ${success} רשומות, ${errors} שגיאות`, success > 0 ? "success" : "error");
  };

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => r.error).length;

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>📤 ייבוא מכירות</h1>
        <Link href="/admin/commissions" className="chip">← חזור</Link>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip chip-active">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
        <Link href="/admin/commissions/team" className="chip">צוות</Link>
        <Link href="/admin/commissions/live" className="chip">📊 לוח חי</Link>
      </div>

      {/* Upload Section */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 16 : 24 }}>
        <h3 className="font-bold mb-3 text-right" style={{ fontSize: 14 }}>📄 ייבוא קווים מ-CSV</h3>
        <p className="text-muted text-xs text-right mb-4">
          העלה קובץ CSV עם נתוני קווים. הורד את התבנית כדי לראות את הפורמט הנדרש.
        </p>

        <div className="flex gap-3 mb-4 justify-end">
          <button onClick={downloadTemplate} className="btn-outline" style={{ fontSize: 11, padding: "8px 16px" }}>
            📥 הורד תבנית
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-primary" style={{ fontSize: 11, padding: "8px 16px" }}>
            📤 בחר קובץ CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" style={{ display: "none" }} />
        </div>

        {/* Preview Table */}
        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-3 text-xs">
                <span className="text-state-success font-bold">✅ {validCount} תקינות</span>
                {errorCount > 0 && <span className="text-state-error font-bold">❌ {errorCount} שגיאות</span>}
              </div>
              <h4 className="text-muted text-xs font-bold">תצוגה מקדימה ({rows.length} שורות)</h4>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                <thead>
                  <tr className="text-muted border-b border-surface-border">
                    <th className="py-1.5 font-semibold">סטטוס</th>
                    <th className="py-1.5 font-semibold">עמלה</th>
                    <th className="py-1.5 font-semibold">הו״ק</th>
                    <th className="py-1.5 font-semibold">מחיר</th>
                    <th className="py-1.5 font-semibold">טלפון</th>
                    <th className="py-1.5 font-semibold">שם</th>
                    <th className="py-1.5 font-semibold">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-surface-border/50" style={{ opacity: r.error ? 0.5 : 1 }}>
                      <td className="py-1.5">
                        {r.error ? <span className="text-state-error text-[9px]">❌ {r.error}</span> : <span className="text-state-success text-[9px]">✅</span>}
                      </td>
                      <td className="py-1.5 font-bold" style={{ color: r.commission > 0 ? "#22c55e" : "#ef4444" }}>{formatCurrency(r.commission)}</td>
                      <td className="py-1.5">{r.has_valid_hk ? "✅" : "❌"}</td>
                      <td className="py-1.5">{formatCurrency(r.package_price)}</td>
                      <td className="py-1.5">{r.customer_phone || "—"}</td>
                      <td className="py-1.5">{r.customer_name || "—"}</td>
                      <td className="py-1.5">{r.sale_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="btn-primary w-full"
              style={{ opacity: importing || validCount === 0 ? 0.5 : 1 }}
            >
              {importing ? "⏳ מייבא..." : `ייבא ${validCount} רשומות`}
            </button>
          </>
        )}

        {rows.length === 0 && !importResult && (
          <EmptyState icon="📤" title="אין נתונים" sub="בחר קובץ CSV כדי להתחיל" />
        )}

        {importResult && (
          <div className="card mt-4" style={{ padding: 16, background: "#18181b" }}>
            <h4 className="font-bold text-center mb-2" style={{ fontSize: 14 }}>📊 סיכום ייבוא</h4>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <div className="font-black text-xl" style={{ color: "#22c55e" }}>{importResult.success}</div>
                <div className="text-muted text-[10px]">יובאו בהצלחה</div>
              </div>
              <div className="text-center">
                <div className="font-black text-xl" style={{ color: "#ef4444" }}>{importResult.errors}</div>
                <div className="text-muted text-[10px]">שגיאות</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
