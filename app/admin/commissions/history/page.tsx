"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useScreen, useToast } from "@/lib/hooks";
import { Modal, FormField, ToastContainer, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { getCsrfToken } from "@/lib/csrf-client";

interface Sale {
  id: number;
  sale_date: string;
  sale_type: string;
  source: string;
  employee_name: string | null;
  order_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  customer_hot_account_id: string | null;
  package_price: number;
  has_valid_hk: boolean;
  device_name: string | null;
  device_sale_amount: number;
  commission_amount: number;
  contract_commission: number;
  notes: string | null;
  store_customer_code_snapshot: string | null;
  match_status: string | null;
  match_method: string | null;
  match_confidence: number | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDefaultHistoryFromDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  date.setDate(1);
  return formatDateInput(date);
}

function getDateRangeFromMonth(month?: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return {
    from: formatDateInput(new Date(year, monthIndex, 1)),
    to: formatDateInput(new Date(year, monthIndex + 1, 0)),
  };
}

function getMonthKey(date?: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date.slice(0, 7);
}

function getDashboardMonthFromFilters(filterFrom?: string | null, filterTo?: string | null, fallbackMonth?: string | null) {
  const fromMonth = getMonthKey(filterFrom);
  const toMonth = getMonthKey(filterTo);

  if (fromMonth && toMonth && fromMonth === toMonth) {
    return fromMonth;
  }

  return fallbackMonth || fromMonth || toMonth || null;
}

function getQueryPage(value?: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getMatchStatusMeta(status?: string | null) {
  switch (status) {
    case "matched":
      return { label: "מותאם", color: "#22c55e" };
    case "pending":
      return { label: "ממתין", color: "#f59e0b" };
    case "unmatched":
      return { label: "לא הותאם", color: "#ef4444" };
    case "ambiguous":
      return { label: "דורש בדיקה", color: "#f97316" };
    case "manual":
      return { label: "ידני", color: "#3b82f6" };
    case "conflict":
      return { label: "התנגשות", color: "#a855f7" };
    default:
      return null;
  }
}

function getSourceMeta(source: string) {
  switch (source) {
    case "auto_sync":
      return { icon: "🔄", label: "סנכרון" };
    case "csv_import":
      return { icon: "📄", label: "CSV" };
    default:
      return { icon: "✏️", label: "ידני" };
  }
}

export default function HistoryPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const parsedSearchParams = new URLSearchParams(searchParamsKey);
  const initialMonthRange = getDateRangeFromMonth(parsedSearchParams.get("month"));
  const [sales, setSales] = useState<Sale[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => getQueryPage(parsedSearchParams.get("page")));
  const limit = 30;

  // Filters
  const [filterType, setFilterType] = useState(() => parsedSearchParams.get("type") || "");
  const [filterSource, setFilterSource] = useState(() => parsedSearchParams.get("source") || "");
  const [selectedEmployee, setSelectedEmployee] = useState(() => parsedSearchParams.get("employee_key") || "");
  const [filterFrom, setFilterFrom] = useState(() => parsedSearchParams.get("from") || initialMonthRange?.from || getDefaultHistoryFromDate());
  const [filterTo, setFilterTo] = useState(() => parsedSearchParams.get("to") || initialMonthRange?.to || formatDateInput(new Date()));
  const [search, setSearch] = useState(() => parsedSearchParams.get("search") || "");

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

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/commissions/employees").then((r) => r.json()).catch(() => ({ data: { employees: [] } })),
      fetch("/api/admin/commissions/profiles").then((r) => r.json()).catch(() => ({ data: { employees: [] } })),
    ]).then(([empRes, profileRes]) => {
      const registryEmployees = (empRes.data?.employees || []).map((employee: any) => ({
        id: `emp:${employee.id}`,
        name: employee.name,
      }));
      const profileEmployees = (profileRes.data?.employees || []).map((employee: any) => ({
        id: employee.id,
        name: employee.name,
      }));
      const seenNames = new Set(registryEmployees.map((employee: EmployeeOption) => employee.name));
      setEmployees([
        ...registryEmployees,
        ...profileEmployees.filter((employee: EmployeeOption) => !seenNames.has(employee.name)),
      ]);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const monthRange = getDateRangeFromMonth(params.get("month"));

    setFilterType(params.get("type") || "");
    setFilterSource(params.get("source") || "");
    setSelectedEmployee(params.get("employee_key") || "");
    setFilterFrom(params.get("from") || monthRange?.from || getDefaultHistoryFromDate());
    setFilterTo(params.get("to") || monthRange?.to || formatDateInput(new Date()));
    setSearch(params.get("search") || "");
    setPage(getQueryPage(params.get("page")));
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (filterType) params.set("type", filterType);
    if (filterSource) params.set("source", filterSource);
    if (selectedEmployee) params.set("employee_key", selectedEmployee);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);

    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set("search", trimmedSearch);
    if (page > 1) params.set("page", String(page));

    const nextSearchParamsKey = params.toString();
    if (nextSearchParamsKey === searchParamsKey) {
      return;
    }

    router.replace(nextSearchParamsKey ? `${pathname}?${nextSearchParamsKey}` : pathname, { scroll: false });
  }, [filterFrom, filterSource, filterTo, filterType, page, pathname, router, search, searchParamsKey, selectedEmployee]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterSource) params.set("source", filterSource);
      if (selectedEmployee) params.set("employee_key", selectedEmployee);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/commissions/sales?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const d = json.data || json;
      const items = Array.isArray(d) ? d : (d.sales || []);
      setSales(items);
      setTotal(json.meta?.total || d.meta?.total || (Array.isArray(d) ? d.length : d.total) || 0);
    } catch { show("שגיאה בטעינת היסטוריה", "error"); }
    finally { setLoading(false); }
  }, [filterType, filterSource, selectedEmployee, filterFrom, filterTo, page, search, show]);

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
  const dashboardMonth = getDashboardMonthFromFilters(filterFrom, filterTo, parsedSearchParams.get("month"));
  const dashboardHref = (() => {
    const params = new URLSearchParams();

    if (dashboardMonth) {
      params.set("month", dashboardMonth);
    }
    if (selectedEmployee) {
      params.set("employee_key", selectedEmployee);
    }

    const query = params.toString();
    return query ? `/admin/commissions?${query}` : "/admin/commissions";
  })();

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>📋 היסטוריית מכירות</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-outline" style={{ fontSize: 10, padding: "6px 12px" }}>📥 ייצא CSV</button>
          <Link href={dashboardHref} className="chip">← חזור</Link>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href={dashboardHref} className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip chip-active">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
        <Link href="/admin/commissions/team" className="chip">צוות</Link>
        <Link href="/admin/commissions/live" className="chip">📊 לוח חי</Link>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">מתאריך</label>
            <input type="date" title="מתאריך" className="input" style={{ fontSize: 11 }} value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">עד תאריך</label>
            <input type="date" title="עד תאריך" className="input" style={{ fontSize: 11 }} value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} />
          </div>
          <div style={{ minWidth: 100 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">סוג</label>
            <select title="סוג" className="input" style={{ fontSize: 11 }} value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
              <option value="">הכל</option>
              <option value="line">קווים</option>
              <option value="device">מכשירים</option>
            </select>
          </div>
          <div style={{ minWidth: 100 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">מקור</label>
            <select title="מקור" className="input" style={{ fontSize: 11 }} value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}>
              <option value="">הכל</option>
              <option value="manual">ידני</option>
              <option value="auto_sync">סנכרון</option>
              <option value="csv_import">CSV</option>
            </select>
          </div>
          <div style={{ minWidth: 140 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">עובד</label>
            <select title="עובד" className="input" style={{ fontSize: 11 }} value={selectedEmployee} onChange={(e) => { setSelectedEmployee(e.target.value); setPage(1); }}>
              <option value="">הכל</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">חיפוש</label>
            <input title="חיפוש" className="input" style={{ fontSize: 11 }} placeholder="לקוח / טלפון / מכשיר / עובד / קוד / הזמנה" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
                  <th className="py-1.5 font-semibold">עמלה</th>
                  <th className="py-1.5 font-semibold">סכום</th>
                  <th className="py-1.5 font-semibold">פרטים</th>
                  <th className="py-1.5 font-semibold">סוג</th>
                  <th className="py-1.5 font-semibold">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const sourceMeta = getSourceMeta(s.source);
                  const matchMeta = getMatchStatusMeta(s.match_status);
                  const amount = s.sale_type === "line" ? s.package_price : s.device_sale_amount;
                  return (
                  <tr key={s.id} className="border-b border-surface-border/50">
                    <td className="py-1.5">
                      <button onClick={() => setDeleteId(s.id)} aria-label={`מחק מכירה ${s.id}`} title="מחק מכירה" className="text-state-error bg-transparent border-0 cursor-pointer text-[10px]">🗑️</button>
                    </td>
                    <td className="py-1.5 text-[9px]">
                      <div className="flex flex-col gap-0.5 items-end">
                        <span>{sourceMeta.icon}</span>
                        <span className="text-muted">{sourceMeta.label}</span>
                      </div>
                    </td>
                    <td className="py-1.5 font-bold" style={{ color: "#22c55e" }}>{formatCurrency(s.commission_amount)}</td>
                    <td className="py-1.5">
                      <div className="flex flex-col gap-0.5 items-end">
                        <span>{formatCurrency(amount)}</span>
                        {s.contract_commission !== s.commission_amount && (
                          <span className="text-muted text-[9px]">חוזה: {formatCurrency(s.contract_commission)}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex flex-col gap-0.5 items-end">
                        <span>{s.sale_type === "line" ? (s.customer_name || s.customer_phone || "—") : (s.device_name || "—")}</span>
                        <div className="flex flex-wrap gap-1 justify-end text-[9px] text-muted">
                          {s.order_id && <span>#{s.order_id}</span>}
                          {s.customer_phone && s.sale_type !== "line" && <span>{s.customer_phone}</span>}
                        </div>
                        {s.employee_name && (
                          <div className="flex flex-wrap gap-1 justify-end mt-0.5">
                            <span className="badge text-[8px]" style={{ background: "#14b8a620", color: "#0f766e" }}>
                              {s.employee_name}
                            </span>
                          </div>
                        )}
                        {(s.store_customer_code_snapshot || matchMeta || s.match_method) && (
                          <div className="flex flex-wrap gap-1 justify-end mt-0.5">
                            {s.store_customer_code_snapshot && (
                              <span className="badge text-[8px]" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                                {s.store_customer_code_snapshot}
                              </span>
                            )}
                            {matchMeta && (
                              <span className="badge text-[8px]" style={{ background: `${matchMeta.color}20`, color: matchMeta.color }}>
                                {matchMeta.label}
                              </span>
                            )}
                            {s.match_method && (
                              <span className="text-muted text-[8px]">
                                {s.match_method}
                                {typeof s.match_confidence === "number" ? ` (${s.match_confidence.toFixed(2)})` : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5">
                      <span className="badge text-[9px]" style={{ background: s.sale_type === "line" ? "#3b82f620" : "#ef444420", color: s.sale_type === "line" ? "#3b82f6" : "#ef4444" }}>
                        {s.sale_type === "line" ? "קו" : "מכשיר"}
                      </span>
                    </td>
                    <td className="py-1.5">{s.sale_date}</td>
                  </tr>
                );})}
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
            <input type="date" title="תאריך" className="input" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
          </FormField>

          {addType === "line" ? (
            <>
              <FormField label="שם לקוח">
                <input title="שם לקוח" className="input" value={addName} onChange={(e) => setAddName(e.target.value)} />
              </FormField>
              <FormField label="טלפון">
                <input title="טלפון" className="input" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="050-1234567" />
              </FormField>
              <FormField label="מחיר חבילה (₪)" required>
                <input type="number" title="מחיר חבילה" className="input" step="0.1" value={addPrice} onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)} />
              </FormField>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-muted text-xs">הו״ק תקינה</label>
                <button
                  title="החלף מצב הו״ק"
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
                <input title="שם מכשיר" className="input" value={addDeviceName} onChange={(e) => setAddDeviceName(e.target.value)} placeholder="iPhone 16 Pro" />
              </FormField>
              <FormField label="סכום מכירה (₪)" required>
                <input type="number" title="סכום מכירה" className="input" value={addDeviceAmount || ""} onChange={(e) => setAddDeviceAmount(parseFloat(e.target.value) || 0)} />
              </FormField>
            </>
          )}

          <FormField label="הערות">
            <textarea title="הערות" className="input" rows={2} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
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
