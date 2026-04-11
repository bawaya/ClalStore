"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { Modal, FormField, ToastContainer, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { getCsrfToken } from "@/lib/csrf-client";

interface Sale {
  id: number;
  sale_date: string;
  sale_type: string;
  source: string;
  customer_name: string | null;
  customer_phone: string | null;
  package_price: number;
  has_valid_hk: boolean;
  device_name: string | null;
  device_sale_amount: number;
  commission_amount: number;
  notes: string | null;
  match_status?: string | null;
  customer_id?: string | null;
  store_customer_code_snapshot?: string | null;
}

const MATCH_STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  matched: { label: "מתואם", color: "#22c55e", icon: "✓" },
  pending: { label: "ממתין", color: "#9ca3af", icon: "⏳" },
  unmatched: { label: "לא מתואם", color: "#ef4444", icon: "⚠" },
  ambiguous: { label: "עמום", color: "#f59e0b", icon: "?" },
  conflict: { label: "סתירה", color: "#ef4444", icon: "!" },
  manual: { label: "ידני", color: "#3b82f6", icon: "✎" },
};

export default function HistoryPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 30;

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterMatch, setFilterMatch] = useState("");
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"line" | "device">("line");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPrice, setAddPrice] = useState(25);
  const [addHK, setAddHK] = useState(true);
  const [addDeviceName, setAddDeviceName] = useState("");
  const [addDeviceAmount, setAddDeviceAmount] = useState(0);
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterSource) params.set("source", filterSource);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/commissions/sales?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const d = json.data || json;
      let items = d.sales || [];

      // Client-side search filter
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((s: Sale) =>
          (s.customer_name || "").toLowerCase().includes(q) ||
          (s.customer_phone || "").includes(q) ||
          (s.device_name || "").toLowerCase().includes(q)
        );
      }
      // Client-side match_status filter
      if (filterMatch) {
        items = items.filter((s: Sale) => (s.match_status || "pending") === filterMatch);
      }
      setSales(items);
      setTotal(d.total || 0);
    } catch { show("שגיאה בטעינת היסטוריה", "error"); }
    finally { setLoading(false); }
  }, [filterType, filterSource, filterFrom, filterTo, page, search, filterMatch, show]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        sale_type: addType,
        sale_date: addDate,
        notes: addNotes || null,
      };
      if (addType === "line") {
        body.customer_name = addName;
        body.customer_phone = addPhone;
        body.package_price = addPrice;
        body.has_valid_hk = addHK;
      } else {
        body.device_name = addDeviceName;
        body.device_sale_amount = addDeviceAmount;
      }

      const res = await fetch("/api/admin/commissions/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      show("המכירה נוספה בהצלחה", "success");
      setShowAdd(false);
      resetAddForm();
      fetchSales();
    } catch { show("שגיאה בהוספת מכירה", "error"); }
    finally { setSaving(false); }
  };

  const resetAddForm = () => {
    setAddName(""); setAddPhone(""); setAddPrice(25); setAddHK(true);
    setAddDeviceName(""); setAddDeviceAmount(0); setAddNotes("");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/commissions/sales?id=${deleteId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      if (!res.ok) throw new Error();
      show("נמחק בהצלחה", "success");
      setDeleteId(null);
      fetchSales();
    } catch { show("שגיאה במחיקה", "error"); }
  };

  const handleExport = () => {
    const month = filterFrom.slice(0, 7);
    window.open(`/api/admin/commissions/export?month=${month}`, "_blank");
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>📋 היסטוריית מכירות</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-outline" style={{ fontSize: 10, padding: "6px 12px" }}>📥 ייצא CSV</button>
          <Link href="/admin/commissions" className="chip">← חזור</Link>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip chip-active">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">מתאריך</label>
            <input type="date" className="input" style={{ fontSize: 11 }} value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">עד תאריך</label>
            <input type="date" className="input" style={{ fontSize: 11 }} value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} />
          </div>
          <div style={{ minWidth: 100 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">סוג</label>
            <select className="input" style={{ fontSize: 11 }} value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
              <option value="">הכל</option>
              <option value="line">קווים</option>
              <option value="device">מכשירים</option>
            </select>
          </div>
          <div style={{ minWidth: 100 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">מקור</label>
            <select className="input" style={{ fontSize: 11 }} value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}>
              <option value="">הכל</option>
              <option value="manual">ידני</option>
              <option value="auto_sync">סנכרון</option>
              <option value="csv_import">CSV</option>
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">מצב התאמה</label>
            <select className="input" style={{ fontSize: 11 }} value={filterMatch} onChange={(e) => { setFilterMatch(e.target.value); setPage(1); }}>
              <option value="">הכל</option>
              {Object.entries(MATCH_STATUS_INFO).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">חיפוש</label>
            <input className="input" style={{ fontSize: 11 }} placeholder="שם לקוח / טלפון / מכשיר" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
        {loading ? (
          <div className="text-center text-muted text-xs py-8">⏳ טוען...</div>
        ) : sales.length === 0 ? (
          <EmptyState icon="📋" title="אין מכירות" sub="הוסף מכירה ראשונה או שנה את הפילטרים" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ fontSize: scr.mobile ? 9 : 12 }}>
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-1.5 font-semibold">פעולות</th>
                  <th className="py-1.5 font-semibold">מקור</th>
                  <th className="py-1.5 font-semibold">התאמה</th>
                  <th className="py-1.5 font-semibold">עמלה</th>
                  <th className="py-1.5 font-semibold">סכום</th>
                  <th className="py-1.5 font-semibold">לקוח/מכשיר</th>
                  <th className="py-1.5 font-semibold">סוג</th>
                  <th className="py-1.5 font-semibold">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-surface-border/50">
                    <td className="py-1.5">
                      <button onClick={() => setDeleteId(s.id)} className="text-state-error bg-transparent border-0 cursor-pointer text-[10px]">🗑️</button>
                    </td>
                    <td className="py-1.5 text-[9px]">
                      {s.source === "auto_sync" ? "🔄" : s.source === "csv_import" ? "📄" : "✏️"}
                    </td>
                    <td className="py-1.5">
                      {(() => {
                        const info = MATCH_STATUS_INFO[s.match_status || "pending"] || MATCH_STATUS_INFO.pending;
                        return (
                          <span className="badge text-[9px]" style={{ background: `${info.color}20`, color: info.color }} title={s.store_customer_code_snapshot || undefined}>
                            {info.icon} {info.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-1.5 font-bold" style={{ color: "#22c55e" }}>{formatCurrency(s.commission_amount)}</td>
                    <td className="py-1.5">{formatCurrency(s.sale_type === "line" ? s.package_price : s.device_sale_amount)}</td>
                    <td className="py-1.5">{s.sale_type === "line" ? (s.customer_name || s.customer_phone || "—") : (s.device_name || "—")}</td>
                    <td className="py-1.5">
                      <span className="badge text-[9px]" style={{ background: s.sale_type === "line" ? "#3b82f620" : "#ef444420", color: s.sale_type === "line" ? "#3b82f6" : "#ef4444" }}>
                        {s.sale_type === "line" ? "קו" : "מכשיר"}
                      </span>
                    </td>
                    <td className="py-1.5">{s.sale_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="chip" style={{ opacity: page <= 1 ? 0.3 : 1 }}>→ הקודם</button>
            <span className="text-muted text-xs">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="chip" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>הבא ←</button>
          </div>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="fixed z-50" style={{ bottom: scr.mobile ? 70 : 24, left: 24 }}>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { setAddType("line"); setShowAdd(true); }}
            className="btn-primary rounded-full shadow-lg"
            style={{ fontSize: 11, padding: "10px 16px" }}
          >
            + קו חדש
          </button>
          <button
            onClick={() => { setAddType("device"); setShowAdd(true); }}
            className="rounded-full shadow-lg border-0 cursor-pointer font-bold"
            style={{ fontSize: 11, padding: "10px 16px", background: "#ef4444", color: "#fff" }}
          >
            + מכירת מכשיר
          </button>
        </div>
      </div>

      {/* Add Sale Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={addType === "line" ? "📡 הוסף קו חדש" : "📱 הוסף מכירת מכשיר"}>
        <div dir="rtl">
          <FormField label="תאריך" required>
            <input type="date" className="input" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
          </FormField>

          {addType === "line" ? (
            <>
              <FormField label="שם לקוח">
                <input className="input" value={addName} onChange={(e) => setAddName(e.target.value)} />
              </FormField>
              <FormField label="טלפון">
                <input className="input" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="050-1234567" />
              </FormField>
              <FormField label="מחיר חבילה (₪)" required>
                <input type="number" className="input" step="0.1" value={addPrice} onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)} />
              </FormField>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-muted text-xs">הו״ק תקינה</label>
                <button
                  onClick={() => setAddHK(!addHK)}
                  className="rounded-full transition-all cursor-pointer border-0"
                  style={{ width: 38, height: 20, background: addHK ? "#c41040" : "#3f3f46", padding: 2 }}
                >
                  <div className="w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: addHK ? "translateX(-18px)" : "translateX(0)" }} />
                </button>
              </div>
            </>
          ) : (
            <>
              <FormField label="שם מכשיר">
                <input className="input" value={addDeviceName} onChange={(e) => setAddDeviceName(e.target.value)} placeholder="iPhone 16 Pro" />
              </FormField>
              <FormField label="סכום מכירה (₪)" required>
                <input type="number" className="input" value={addDeviceAmount || ""} onChange={(e) => setAddDeviceAmount(parseFloat(e.target.value) || 0)} />
              </FormField>
            </>
          )}

          <FormField label="הערות">
            <textarea className="input" rows={2} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
          </FormField>

          <button onClick={handleAdd} disabled={saving} className="btn-primary w-full mt-2" style={{ opacity: saving ? 0.5 : 1 }}>
            {saving ? "⏳ שומר..." : "שמור מכירה"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="מחיקת מכירה"
        message="האם למחוק את המכירה? פעולה זו לא ניתנת לביטול."
      />
    </div>
  );
}
