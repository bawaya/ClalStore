"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useScreen, useToast } from "@/lib/hooks";
import { StatCard, Modal, FormField, ToastContainer, ConfirmDialog } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { getCsrfToken } from "@/lib/csrf-client";
import { lastDayOfMonth } from "@/lib/commissions/date-utils";

interface PaceLines {
  target: number;
  achieved: number;
  remaining: number;
  perDayPace: number;
  requiredPerDay: number;
  expectedPace: number;
  paceStatus: "ahead" | "on_track" | "behind";
}

interface PaceDevices {
  target: number;
  achieved: number;
  remaining: number;
  perDayPace: number;
  requiredPerDay: number;
  expectedPace: number;
  paceStatus: "ahead" | "on_track" | "behind";
  totalSalesAmount: number;
  amountPerDayPace: number;
}

interface PaceTracking {
  daysInMonth: number;
  daysElapsed: number;
  daysLeft: number;
  totalWorkingDays: number;
  workingDaysElapsed: number;
  workingDaysLeft: number;
  isCurrentMonth: boolean;
  overallPaceStatus: "ahead" | "on_track" | "behind";
  // Sales-oriented metrics (primary — used by progress bar + pace card)
  salesPerDayPace: number;
  salesRequiredPerDay: number;
  salesExpectedPace: number;
  totalSalesAmount: number;
  autoTrackedSalesAmount: number;
  manualSalesAddOn: number;
  manualAddOnDeviceCommission: number;
  targetSalesAmount: number;
  salesProgress: number;
  totalLineSalesAmount: number;
  totalDeviceSalesAmount: number;
  autoTrackedDeviceSales: number;
  // Commission pace (secondary)
  commissionPerDayPace: number;
  commissionRequiredPerDay: number;
  commissionExpectedPace: number;
  lines: PaceLines;
  devices: PaceDevices;
}

interface TargetDetails {
  target_total: number;
  target_lines_count: number;
  target_devices_count: number;
  target_lines_amount: number;
  target_devices_amount: number;
  target_sales_amount: number;
  manual_sales_add_on: number;
  is_locked: boolean;
  locked_at: string | null;
}

interface DashboardSale {
  id: number;
  sale_date: string;
  sale_type: string;
  customer_name?: string;
  device_name?: string;
  commission_amount: number;
  source: string;
  package_price?: number;
  device_sale_amount?: number;
  order_id?: string | null;
  store_customer_code_snapshot?: string | null;
  match_status?: string | null;
  match_method?: string | null;
  match_confidence?: number | null;
  employee_id?: string | null;
  employee_name?: string | null;
  customer_hot_account_id?: string | null;
}

interface DashboardData {
  summary: {
    linesCommission: number;
    devicesCommission: number;
    loyaltyBonus: number;
    grossCommission: number;
    totalSanctions: number;
    netCommission: number;
    targetAmount: number;
    targetProgress: number;
    autoSyncedCount: number;
    manualEntryCount: number;
  };
  deviceCalc: {
    basePct: number;
    milestoneCount: number;
    milestoneBonus: number;
    total: number;
    nextMilestoneAt: number;
    nextMilestoneProgress: number;
  };
  dailyBreakdown: Array<{ date: string; lines: number; devices: number }>;
  alerts: Array<{ text: string; color: string }>;
  syncInfo: { lastSync: string; ordersSynced: number; status: string } | null;
  recentSales: DashboardSale[];
  historicalRecentSales: DashboardSale[];
  historicalSummary: {
    latestSaleDate: string | null;
    unassignedAutoSyncEmployeeCount: number;
  };
  month: string;
  paceTracking: PaceTracking;
  targetDetails: TargetDetails | null;
}

const paceStatusColor = (status: string) =>
  status === "ahead" ? "#3b82f6" : status === "on_track" ? "#22c55e" : "#ef4444";
const paceStatusLabel = (status: string) =>
  status === "ahead" ? "מקדים" : status === "on_track" ? "בזמן" : "בפיגור";
const paceStatusIcon = (status: string) =>
  status === "ahead" ? "🚀" : status === "on_track" ? "✅" : "⚠️";

interface Employee { id: string; name: string; role: string; }

export default function CommissionsDashboard() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const parsedSearchParams = new URLSearchParams(searchParamsKey);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => parsedSearchParams.get("month") || "");
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetAmount, setTargetAmount] = useState("");
  const [targetLinesCount, setTargetLinesCount] = useState("");
  const [targetDevicesCount, setTargetDevicesCount] = useState("");
  const [targetSalesAmountInput, setTargetSalesAmountInput] = useState("");
  const [manualSalesAddOnInput, setManualSalesAddOnInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [locking, setLocking] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>(() => parsedSearchParams.get("employee_key") || "");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Pull count of pending sales-requests so the admin sees at a glance
  // how many need review. Refreshed alongside dashboard refreshes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/sales-requests?count=pending", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const c = ((json.data ?? json) as { count?: number }).count || 0;
        if (!cancelled) setPendingRequestsCount(c);
      } catch {
        // silent — non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load employees from commission_employees table (standalone) + profiles (user-linked)
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/commissions/employees").then(r => r.json()).catch(() => ({ data: { employees: [] } })),
      fetch("/api/admin/commissions/profiles").then(r => r.json()).catch(() => ({ data: { employees: [] } })),
    ]).then(([empRes, profRes]) => {
      const commEmps = (empRes.data?.employees || []).map((e: any) => ({
        id: `emp:${e.id}`, name: e.name, role: e.role || "sales",
      }));
      const profileEmps = (profRes.data?.employees || []).map((e: any) => ({
        id: e.id, name: e.name, role: e.role,
      }));
      // Merge: commission_employees first, then profile-based (avoid duplicates by name)
      const nameSet = new Set(commEmps.map((e: Employee) => e.name));
      const merged = [...commEmps, ...profileEmps.filter((e: Employee) => !nameSet.has(e.name))];
      setEmployees(merged);
    });
  }, []);

  const fetchDashboard = useCallback(async (m: string, empKey?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (m) {
        params.set("month", m);
      }
      if (empKey) {
        // emp:123 = commission_employees id — resolve to name for filtering
        params.set("employee_key", empKey);
      }
      const res = await fetch(`/api/admin/commissions/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      const nextData = json.data || json;
      setData(nextData);
      if (nextData?.month && nextData.month !== m) {
        setMonth(nextData.month);
      }
    } catch {
      show("שגיאה בטעינת הנתונים", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);

    setMonth(params.get("month") || "");
    setSelectedEmployee(params.get("employee_key") || "");
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (month) {
      params.set("month", month);
    }
    if (selectedEmployee) {
      params.set("employee_key", selectedEmployee);
    }

    const nextSearchParamsKey = params.toString();
    if (nextSearchParamsKey === searchParamsKey) {
      return;
    }

    router.replace(nextSearchParamsKey ? `${pathname}?${nextSearchParamsKey}` : pathname, { scroll: false });
  }, [month, pathname, router, searchParamsKey, selectedEmployee]);

  useEffect(() => { fetchDashboard(month, selectedEmployee); }, [month, selectedEmployee, fetchDashboard]);

  const handleOpenTargetModal = () => {
    // Pre-fill with existing values so admin can tweak rather than re-enter.
    const td = data?.targetDetails;
    setTargetAmount(td?.target_total ? String(td.target_total) : "");
    setTargetLinesCount(td?.target_lines_count ? String(td.target_lines_count) : "");
    setTargetDevicesCount(td?.target_devices_count ? String(td.target_devices_count) : "");
    setTargetSalesAmountInput(td?.target_sales_amount ? String(td.target_sales_amount) : "");
    setManualSalesAddOnInput(td?.manual_sales_add_on ? String(td.manual_sales_add_on) : "");
    setShowTargetModal(true);
  };

  const handleSetTarget = async () => {
    const amt = parseFloat(targetAmount);
    if (!amt || amt <= 0) { show("הזן סכום יעד תקין", "warning"); return; }
    try {
      const res = await fetch("/api/admin/commissions/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({
          month,
          employee_key: selectedEmployee || undefined,
          target_total: amt,
          target_lines_count: parseInt(targetLinesCount) || 0,
          target_devices_count: parseInt(targetDevicesCount) || 0,
          target_sales_amount: targetSalesAmountInput ? parseFloat(targetSalesAmountInput) : null,
          manual_sales_add_on: manualSalesAddOnInput ? parseFloat(manualSalesAddOnInput) : 0,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "save failed");
      }
      show("היעד נשמר בהצלחה", "success");
      setShowTargetModal(false);
      setTargetAmount("");
      setTargetLinesCount("");
      setTargetDevicesCount("");
      setTargetSalesAmountInput("");
      setManualSalesAddOnInput("");
      fetchDashboard(month, selectedEmployee);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בשמירת היעד";
      show(msg, "error");
    }
  };

  const handleLockToggle = async () => {
    if (!data?.targetDetails) return;
    const isLocked = data.targetDetails.is_locked;
    setLocking(true);
    try {
      const res = await fetch("/api/admin/commissions/targets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({
          month,
          action: isLocked ? "unlock" : "lock",
          employee_key: selectedEmployee || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      show(isLocked ? "היעד שוחרר לעריכה" : "היעד ננעל בהצלחה", "success");
      setShowLockConfirm(false);
      fetchDashboard(month, selectedEmployee);
    } catch {
      show("שגיאה בעדכון נעילה", "error");
    } finally {
      setLocking(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const startDate = `${month}-01`;
      const endDate = lastDayOfMonth(month);
      const res = await fetch("/api/admin/commissions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const d = json.data || json;
      show(`סונכרנו ${d.synced} הזמנות (${d.skipped} דולגו)`, "success");
      fetchDashboard(month, selectedEmployee);
    } catch { show("שגיאה בסנכרון", "error"); }
    finally { setSyncing(false); }
  };

  if (loading) return <div className="text-center py-20 text-muted" dir="rtl">טוען נתונים...</div>;
  if (!data) return null;

  const s = data.summary;
  const pace = data.paceTracking;
  const td = data.targetDetails;
  const isLocked = td?.is_locked || false;
  const maxDaily = Math.max(...data.dailyBreakdown.map((d) => d.lines + d.devices), 1);
  const displayedSales = data.recentSales.length > 0 ? data.recentSales : data.historicalRecentSales;
  const showingHistoricalFallback = data.recentSales.length === 0 && data.historicalRecentSales.length > 0;
  const buildHistoryHref = (options?: { source?: string; includeEmployee?: boolean }) => {
    const params = new URLSearchParams();
    const historyMonth = month || data.month;

    if (historyMonth) {
      params.set("month", historyMonth);
    }
    if (options?.includeEmployee !== false && selectedEmployee) {
      params.set("employee_key", selectedEmployee);
    }
    if (options?.source) {
      params.set("source", options.source);
    }

    const query = params.toString();
    return query ? `/admin/commissions/history?${query}` : "/admin/commissions/history";
  };
  const historyHref = buildHistoryHref();
  const autoSyncHistoryHref = buildHistoryHref({ source: "auto_sync", includeEmployee: false });

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black text-slate-50" style={{ fontSize: scr.mobile ? 18 : 26 }}>
          💰 לוח בקרה — מכירות ועמלות
          {selectedEmployee && <span className="text-slate-300 text-sm font-normal mr-2">({employees.find(e => e.id === selectedEmployee)?.name})</span>}
        </h1>
        <div className="flex items-center gap-2">
          {employees.length > 0 && (
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="input"
              style={{ width: scr.mobile ? 100 : 150, fontSize: 11, padding: "6px 8px" }}
            >
              <option value="">חוזה HOT (הכל)</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
            style={{ width: scr.mobile ? 130 : 160, fontSize: 12, padding: "6px 10px" }}
          />
          <Link href={historyHref} className="chip text-[10px]">📋 היסטוריה</Link>
          <Link href="/admin/commissions/calculator" className="chip chip-active text-[10px]">🧮 מחשבון</Link>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip chip-active">לוח בקרה</Link>
        <Link href="/admin/commissions/requests" className="chip relative">
          📥 طلبات المبيعات
          {pendingRequestsCount > 0 && (
            <span
              className="absolute -top-1.5 -left-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[9px] font-black text-white"
              aria-label={`${pendingRequestsCount} طلب بانتظار المراجعة`}
            >
              {pendingRequestsCount > 99 ? "99+" : pendingRequestsCount}
            </span>
          )}
        </Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href={historyHref} className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
        <Link href="/admin/commissions/team" className="chip">צוות</Link>
        <Link href="/admin/commissions/live" className="chip">📊 לוח חי</Link>
      </div>

      {/* Primary Sales Hero — bigger fonts, higher contrast, sales-focused.
          The whole page is oriented around sales VALUE (₪ sold); commission
          now appears as secondary info below. */}
      <div
        className="card mb-3"
        style={{
          padding: scr.mobile ? 14 : 20,
          background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08))",
          borderRight: "4px solid #22c55e",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-right">
            <div className="text-slate-200 font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>
              💰 סה&quot;כ מכירות
            </div>
          </div>
          <div className="text-left">
            <div
              className="font-black"
              style={{
                fontSize: scr.mobile ? 28 : 40,
                color: "#22c55e",
                lineHeight: 1,
              }}
            >
              {formatCurrency(pace.totalSalesAmount)}
            </div>
            {pace.targetSalesAmount > 0 && (
              <div className="text-[11px] text-slate-200 mt-1 font-bold">
                מתוך {formatCurrency(pace.targetSalesAmount)} — {pace.salesProgress}%
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="text-right rounded-lg p-2" style={{ background: "rgba(59,130,246,0.12)" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 18 }}>📡</span>
              <span className="text-slate-100 font-semibold" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                מכירות קווים
              </span>
            </div>
            <div
              className="font-black mt-1"
              style={{ fontSize: scr.mobile ? 18 : 24, color: "#60a5fa" }}
            >
              {formatCurrency(pace.totalLineSalesAmount)}
            </div>
          </div>
          <div className="text-right rounded-lg p-2" style={{ background: "rgba(239,68,68,0.12)" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 18 }}>📱</span>
              <span className="text-slate-100 font-semibold" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                מכירות מכשירים
              </span>
            </div>
            <div
              className="font-black mt-1"
              style={{ fontSize: scr.mobile ? 18 : 24, color: "#f87171" }}
            >
              {formatCurrency(pace.totalDeviceSalesAmount)}
            </div>
            {pace.manualSalesAddOn > 0 && (
              <div className="mt-1.5 flex items-center justify-between gap-1 rounded-md px-1.5 py-1" style={{ background: "rgba(239,68,68,0.22)" }}>
                <span className="font-bold text-[10px]" style={{ color: "#f87171" }}>
                  +{formatCurrency(pace.manualAddOnDeviceCommission)} עמלה
                </span>
                <span className="text-[10px] text-slate-100 font-semibold">
                  +{formatCurrency(pace.manualSalesAddOn)} הוספה ידנית
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary — Commission breakdown (user asked this stay as backup info).
          devicesCommission already includes the commission generated by the
          manual add-on (treated as virtual device sales); sub-line makes that
          split visible so admin knows the source. */}
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
        <StatCard icon="📡" label="עמלות קווים" value={formatCurrency(s.linesCommission)} color="#3b82f6" />
        <StatCard
          icon="📱"
          label="עמלות מכשירים"
          value={formatCurrency(s.devicesCommission)}
          color="#ef4444"
          sub={pace.manualAddOnDeviceCommission > 0
            ? `כולל ${formatCurrency(pace.manualAddOnDeviceCommission)} מהוספה ידנית`
            : undefined}
        />
        <StatCard icon="⚠️" label="סנקציות" value={formatCurrency(s.totalSanctions)} color="#f97316" />
        <StatCard icon="💵" label="עמלות נטו" value={formatCurrency(s.netCommission)} color="#22c55e" />
      </div>

      {/* Owner Profit Card — only in aggregate view */}
      {!selectedEmployee && (data as any).ownerProfit && (data as any).ownerProfit.employeeCosts > 0 && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 16, borderRight: "4px solid #8b5cf6" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-muted text-[10px]">רווח בעל הנקודה</div>
              <div className="font-black text-lg" style={{ color: "#8b5cf6" }}>
                {formatCurrency((data as any).ownerProfit.netProfit)}
              </div>
            </div>
            <div className="text-left text-[10px] text-muted">
              <div>עמלות חוזה: {formatCurrency((data as any).ownerProfit.contractTotal)}</div>
              <div>עלות עובדים: {formatCurrency((data as any).ownerProfit.employeeCosts)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Performance Breakdown — aggregate view only */}
      {!selectedEmployee && (data as any).employeeBreakdown?.length > 1 && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 16 }}>
          <div className="flex items-center justify-between mb-3">
            <Link href="/admin/commissions/team" className="text-brand text-[10px] font-bold">לוח מובילים ←</Link>
            <h3 className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>👥 ביצועי עובדים</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ fontSize: scr.mobile ? 10 : 11 }}>
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-1.5 font-semibold text-center">%</th>
                  <th className="py-1.5 font-semibold text-center">עמלה</th>
                  <th className="py-1.5 font-semibold text-center">מכשירים</th>
                  <th className="py-1.5 font-semibold text-center">קווים</th>
                  <th className="py-1.5 font-semibold">עובד</th>
                </tr>
              </thead>
              <tbody>
                {((data as any).employeeBreakdown as Array<{ name: string; lines: number; devices: number; commission: number; pct: number }>).map((emp, i) => (
                  <tr key={emp.name} className="border-b border-surface-border/50">
                    <td className="py-1.5 text-center text-muted">{emp.pct}%</td>
                    <td className="py-1.5 text-center font-bold" style={{ color: "#22c55e" }}>{formatCurrency(emp.commission)}</td>
                    <td className="py-1.5 text-center">{emp.devices}</td>
                    <td className="py-1.5 text-center">{emp.lines}</td>
                    <td className="py-1.5 font-bold">
                      {i === 0 && "🥇 "}{i === 1 && "🥈 "}{i === 2 && "🥉 "}{emp.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Target Progress + Lock — primary bar shows SALES progress, secondary
          shows commission progress as smaller info row. */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {!isLocked && (
              <button onClick={handleOpenTargetModal} className="btn-outline" style={{ fontSize: 11, padding: "6px 14px" }}>
                {(s.targetAmount > 0 || pace.targetSalesAmount > 0) ? "עדכן יעד" : "הגדר יעד"}
              </button>
            )}
            {(s.targetAmount > 0 || pace.targetSalesAmount > 0) && (
              <button
                onClick={() => setShowLockConfirm(true)}
                className="btn-outline"
                style={{
                  fontSize: 11,
                  padding: "6px 14px",
                  borderColor: isLocked ? "#22c55e" : "#f97316",
                  color: isLocked ? "#22c55e" : "#f97316",
                }}
              >
                {isLocked ? "🔒 נעול" : "🔓 נעל יעד"}
              </button>
            )}
          </div>
          <h3 className="font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>🎯 התקדמות ליעד</h3>
        </div>

        {/* Primary progress — SALES (bigger, bolder) */}
        {pace.targetSalesAmount > 0 ? (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 13 : 16 }}>
                {pace.salesProgress}%
              </span>
              <span className="text-slate-200 font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>
                מכירות: {formatCurrency(pace.totalSalesAmount)} / {formatCurrency(pace.targetSalesAmount)}
              </span>
            </div>
            <div className="w-full h-5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, pace.salesProgress)}%`,
                  background: pace.salesProgress >= 80 ? "#22c55e" : pace.salesProgress >= 50 ? "#eab308" : "#ef4444",
                }}
              />
            </div>

            {/* Target gap highlight — the two numbers admin asked for:
                (1) how much sales value is still needed to reach the target
                (2) what per-working-day sales pace closes the gap */}
            {(() => {
              const salesRemaining = Math.max(0, pace.targetSalesAmount - pace.totalSalesAmount);
              const targetReached = salesRemaining <= 0;
              const accent = targetReached
                ? "#22c55e"
                : pace.salesProgress >= 50
                  ? "#eab308"
                  : "#ef4444";
              return (
                <div
                  className="grid gap-2 mt-3"
                  style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr" }}
                >
                  <div
                    className="rounded-xl px-3 py-2.5 text-right"
                    style={{ background: `${accent}18`, border: `1px solid ${accent}40` }}
                  >
                    <div className="text-slate-200 font-semibold" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                      💸 נותרו למכירה (כל החודש)
                    </div>
                    <div
                      className="font-black mt-1"
                      style={{ fontSize: scr.mobile ? 18 : 24, color: accent, lineHeight: 1.1 }}
                    >
                      {targetReached ? "✅ הגעת!" : formatCurrency(salesRemaining)}
                    </div>
                  </div>
                  <div
                    className="rounded-xl px-3 py-2.5 text-right"
                    style={{ background: `${accent}18`, border: `1px solid ${accent}40` }}
                  >
                    <div className="text-slate-200 font-semibold" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                      📈 למכור ליום (כדי לסגור היעד)
                    </div>
                    <div
                      className="font-black mt-1"
                      style={{ fontSize: scr.mobile ? 18 : 24, color: accent, lineHeight: 1.1 }}
                    >
                      {targetReached
                        ? "—"
                        : pace.workingDaysLeft > 0
                          ? formatCurrency(pace.salesRequiredPerDay)
                          : "אין ימי עבודה"}
                    </div>
                    {!targetReached && pace.workingDaysLeft > 0 && (
                      <div className="text-slate-300 text-[10px] mt-0.5">
                        ל-{pace.workingDaysLeft} ימי עבודה שנותרו
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : s.targetAmount > 0 ? (
          <div className="text-slate-300 text-[11px] mb-2 text-right">
            לא הוגדר יעד מכירות (₪). מוצג יעד עמלות בלבד למטה.
          </div>
        ) : (
          <div className="text-center text-slate-300 text-xs py-2">לא הוגדר יעד לחודש זה</div>
        )}

        {/* Secondary progress — COMMISSION (smaller, secondary) */}
        {s.targetAmount > 0 && (
          <div className="pt-2 border-t border-surface-border">
            <div className="flex items-center justify-between mb-1" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              <span className="text-slate-300">{s.targetProgress}%</span>
              <span className="text-slate-300">
                עמלות: {formatCurrency(s.netCommission)} / {formatCurrency(s.targetAmount)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, s.targetProgress)}%`,
                  background: s.targetProgress >= 80 ? "#22c55e" : s.targetProgress >= 50 ? "#eab308" : "#ef4444",
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        )}

        {/* Footer — lock date + count targets */}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div className="flex gap-3 text-[10px] text-slate-300">
            {td && td.target_lines_count > 0 && <span>יעד קווים: {td.target_lines_count}</span>}
            {td && td.target_devices_count > 0 && <span>יעד מכשירים: {td.target_devices_count}</span>}
          </div>
          {isLocked && td?.locked_at && (
            <div className="text-[9px] text-slate-400">
              ננעל ב-{new Date(td.locked_at).toLocaleDateString("he-IL")}
            </div>
          )}
        </div>
      </div>

      {/* Pace Tracking Bar — primary metric is SALES per day; commission
          per day is shown as smaller secondary info. */}
      {pace.isCurrentMonth && (s.targetAmount > 0 || pace.targetSalesAmount > 0) && (
        <div
          className="card mb-4"
          style={{
            padding: scr.mobile ? 12 : 18,
            borderRight: `3px solid ${paceStatusColor(pace.overallPaceStatus)}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-bold text-[11px] px-2 py-1 rounded"
              style={{
                color: paceStatusColor(pace.overallPaceStatus),
                background: `${paceStatusColor(pace.overallPaceStatus)}20`,
              }}
            >
              {paceStatusIcon(pace.overallPaceStatus)} {paceStatusLabel(pace.overallPaceStatus)}
            </span>
            <h3 className="font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>⏱️ מעקב קצב</h3>
          </div>

          {/* Primary sales pace (if sales target set) */}
          {pace.targetSalesAmount > 0 && (
            <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
              <div className="text-center rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-slate-300 text-[10px] mb-0.5">ימי עבודה</div>
                <div className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                  {pace.workingDaysElapsed} / {pace.totalWorkingDays}
                </div>
              </div>
              <div className="text-center rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-slate-300 text-[10px] mb-0.5">נותרו</div>
                <div className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                  {pace.workingDaysLeft} ימים
                </div>
              </div>
              <div className="text-center rounded-lg p-2" style={{ background: `${paceStatusColor(pace.overallPaceStatus)}15` }}>
                <div className="text-slate-200 text-[10px] mb-0.5 font-semibold">קצב מכירות</div>
                <div
                  className="font-black"
                  style={{
                    fontSize: scr.mobile ? 14 : 18,
                    color: paceStatusColor(pace.overallPaceStatus),
                  }}
                >
                  {formatCurrency(pace.salesPerDayPace)}
                </div>
                <div className="text-slate-300 text-[9px]">ליום</div>
              </div>
              <div className="text-center rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-slate-200 text-[10px] mb-0.5 font-semibold">נדרש מכירות</div>
                <div className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                  {formatCurrency(pace.salesRequiredPerDay)}
                </div>
                <div className="text-slate-300 text-[9px]">ליום</div>
              </div>
            </div>
          )}

          {/* Fallback — if no sales target, show commission pace as primary */}
          {pace.targetSalesAmount === 0 && s.targetAmount > 0 && (
            <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
              <div className="text-center rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-slate-300 text-[10px] mb-0.5">ימי עבודה</div>
                <div className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                  {pace.workingDaysElapsed} / {pace.totalWorkingDays}
                </div>
              </div>
              <div className="text-center rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-slate-300 text-[10px] mb-0.5">נותרו</div>
                <div className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                  {pace.workingDaysLeft} ימים
                </div>
              </div>
              <div className="text-center rounded-lg p-2" style={{ background: `${paceStatusColor(pace.overallPaceStatus)}15` }}>
                <div className="text-slate-200 text-[10px] mb-0.5 font-semibold">קצב עמלות</div>
                <div
                  className="font-black"
                  style={{
                    fontSize: scr.mobile ? 14 : 18,
                    color: paceStatusColor(pace.overallPaceStatus),
                  }}
                >
                  {formatCurrency(pace.commissionPerDayPace)}
                </div>
                <div className="text-slate-300 text-[9px]">ליום</div>
              </div>
              <div className="text-center rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-slate-200 text-[10px] mb-0.5 font-semibold">נדרש עמלות</div>
                <div className="font-black text-slate-100" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                  {formatCurrency(pace.commissionRequiredPerDay)}
                </div>
                <div className="text-slate-300 text-[9px]">ליום</div>
              </div>
            </div>
          )}

          {/* Secondary — commission pace as footnote (only when sales target set) */}
          {pace.targetSalesAmount > 0 && s.targetAmount > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-300 pt-2 border-t border-surface-border">
              <span>
                קצב עמלות: <span className="font-bold text-slate-100">{formatCurrency(pace.commissionPerDayPace)}</span>/יום
              </span>
              <span>
                נדרש עמלות: <span className="font-bold text-slate-100">{formatCurrency(pace.commissionRequiredPerDay)}</span>/יום
              </span>
            </div>
          )}

          {/* Time progress bar */}
          <div className="mt-2">
            <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pace.totalWorkingDays > 0 ? Math.min(100, (pace.workingDaysElapsed / pace.totalWorkingDays) * 100) : 0}%`,
                  background: paceStatusColor(pace.overallPaceStatus),
                }}
              />
            </div>
            <div className="text-[10px] text-slate-300 text-center mt-1">
              {pace.totalWorkingDays > 0 ? Math.round((pace.workingDaysElapsed / pace.totalWorkingDays) * 100) : 0}% מהחודש חלף
            </div>
          </div>
        </div>
      )}

      {/* "What You Need" Boxes — Lines + Devices */}
      {pace.isCurrentMonth && (pace.lines.target > 0 || pace.devices.target > 0) && (
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }} className="mb-4">
          {/* Lines Need Box */}
          {pace.lines.target > 0 && (
            <div
              className="card flex-1 mb-3"
              style={{
                padding: scr.mobile ? 12 : 18,
                borderRight: `3px solid #3b82f6`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded"
                  style={{
                    color: paceStatusColor(pace.lines.paceStatus),
                    background: `${paceStatusColor(pace.lines.paceStatus)}15`,
                  }}
                >
                  {paceStatusIcon(pace.lines.paceStatus)} {paceStatusLabel(pace.lines.paceStatus)}
                </span>
                <h4 className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>📡 מה צריך — קווים</h4>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pace.lines.target > 0 ? Math.min(100, (pace.lines.achieved / pace.lines.target) * 100) : 0}%`,
                    background: "#3b82f6",
                  }}
                />
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="font-bold">{pace.lines.target}</span>
                  <span className="text-muted">יעד קווים</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: "#3b82f6" }}>{pace.lines.achieved}</span>
                  <span className="text-muted">הושגו</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: pace.lines.remaining > 0 ? "#f97316" : "#22c55e" }}>{pace.lines.remaining}</span>
                  <span className="text-muted">נותרו</span>
                </div>
                <div className="border-t border-surface-border pt-1.5 flex justify-between">
                  <span className="font-bold">{pace.lines.requiredPerDay}</span>
                  <span className="text-muted">קווים נדרשים ליום</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: paceStatusColor(pace.lines.paceStatus) }}>
                    {pace.lines.perDayPace}
                  </span>
                  <span className="text-muted">קצב נוכחי (ליום)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">{pace.lines.expectedPace}</span>
                  <span className="text-muted">קצב נדרש (ליום)</span>
                </div>
              </div>

              {pace.lines.paceStatus === "behind" && (
                <div className="mt-2 bg-state-error/10 border border-state-error/30 rounded-lg px-3 py-1.5 text-[10px] text-state-error font-bold text-right">
                  הקצב הנוכחי ({pace.lines.perDayPace}/יום) נמוך מהנדרש ({pace.lines.expectedPace}/יום)
                </div>
              )}
            </div>
          )}

          {/* Devices Need Box */}
          {pace.devices.target > 0 && (
            <div
              className="card flex-1 mb-3"
              style={{
                padding: scr.mobile ? 12 : 18,
                borderRight: `3px solid #ef4444`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded"
                  style={{
                    color: paceStatusColor(pace.devices.paceStatus),
                    background: `${paceStatusColor(pace.devices.paceStatus)}15`,
                  }}
                >
                  {paceStatusIcon(pace.devices.paceStatus)} {paceStatusLabel(pace.devices.paceStatus)}
                </span>
                <h4 className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>📱 מה צריך — מכשירים</h4>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pace.devices.target > 0 ? Math.min(100, (pace.devices.achieved / pace.devices.target) * 100) : 0}%`,
                    background: "#ef4444",
                  }}
                />
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="font-bold">{pace.devices.target}</span>
                  <span className="text-muted">יעד מכירות מכשירים</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: "#ef4444" }}>{pace.devices.achieved}</span>
                  <span className="text-muted">הושגו</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: pace.devices.remaining > 0 ? "#f97316" : "#22c55e" }}>{pace.devices.remaining}</span>
                  <span className="text-muted">נותרו</span>
                </div>
                <div className="border-t border-surface-border pt-1.5 flex justify-between">
                  <span className="font-bold">{pace.devices.requiredPerDay}</span>
                  <span className="text-muted">מכירות נדרשות ליום</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: paceStatusColor(pace.devices.paceStatus) }}>
                    {pace.devices.perDayPace}
                  </span>
                  <span className="text-muted">קצב נוכחי (ליום)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">{pace.devices.expectedPace}</span>
                  <span className="text-muted">קצב נדרש (ליום)</span>
                </div>
              </div>

              {pace.devices.paceStatus === "behind" && (
                <div className="mt-2 bg-state-error/10 border border-state-error/30 rounded-lg px-3 py-1.5 text-[10px] text-state-error font-bold text-right">
                  הקצב הנוכחי ({pace.devices.perDayPace}/יום) נמוך מהנדרש ({pace.devices.expectedPace}/יום)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Smart Alerts */}
      {data.alerts.length > 0 && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>💡 התראות חכמות</h3>
          <div className="space-y-1.5">
            {data.alerts.map((alert, i) => (
              <div key={i} className="rounded-xl px-3 py-2 text-right" style={{ background: `${alert.color}15`, fontSize: scr.mobile ? 10 : 12 }}>
                <span style={{ color: alert.color }} className="font-bold">{alert.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Chart + Device Milestone */}
      <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }}>
        {/* Daily Performance */}
        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-3 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📊 ביצועים יומיים</h3>
          {data.dailyBreakdown.length === 0 ? (
            <div className="text-center text-dim text-xs py-4">אין נתונים לחודש זה</div>
          ) : (
            <div className="flex items-end gap-1" style={{ height: 100 }}>
              {data.dailyBreakdown.map((d) => {
                const total = d.lines + d.devices;
                const h = Math.max(4, (total / maxDaily) * 100);
                const linesH = total > 0 ? (d.lines / total) * h : 0;
                const devicesH = h - linesH;
                return (
                  <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: ₪${total.toFixed(0)}`}>
                    <div className="rounded-t" style={{ height: devicesH, background: "#ef4444", minWidth: 4 }} />
                    <div className="rounded-b" style={{ height: linesH, background: "#3b82f6", minWidth: 4 }} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-center gap-4 mt-2">
            <span className="text-[9px] text-muted flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#3b82f6" }} /> קווים</span>
            <span className="text-[9px] text-muted flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: "#ef4444" }} /> מכשירים</span>
          </div>
        </div>

        {/* Device Milestone Progress */}
        <div className="card mb-3" style={{ padding: scr.mobile ? 12 : 18, width: scr.mobile ? "100%" : 280 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>🏆 מדרגות מכשירים</h3>
          <div className="text-center mb-2">
            <div className="font-black text-2xl" style={{ color: "#ef4444" }}>{data.deviceCalc.milestoneCount}</div>
            <div className="text-muted text-[10px]">מדרגות הושגו (x₪2,500)</div>
          </div>
          <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${data.deviceCalc.nextMilestoneProgress}%` }} />
          </div>
          <div className="text-muted text-[10px] text-right">
            {formatCurrency(data.deviceCalc.nextMilestoneAt)} למדרגה הבאה
          </div>
          <div className="text-muted text-[10px] text-right mt-1">
            בונוס מדרגות: {formatCurrency(data.deviceCalc.milestoneBonus)}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
        <div className="flex items-center justify-between mb-2">
          <Link href={historyHref} className="text-brand text-[10px] font-bold">הצג הכל ←</Link>
          <h3 className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>📋 מכירות אחרונות</h3>
        </div>
        {displayedSales.length === 0 ? (
          <div className="text-center text-dim text-xs py-4">אין מכירות עדיין</div>
        ) : (
          <div className="overflow-x-auto">
            {showingHistoricalFallback && (
              <div className="mb-3 rounded-xl border border-state-warning/30 bg-state-warning/10 px-3 py-2 text-right text-[10px] text-state-warning">
                אין מכירות בחודש זה. מוצגות המכירות האחרונות מחודשים קודמים
                {data.historicalSummary.latestSaleDate ? ` (آخر مبيع: ${data.historicalSummary.latestSaleDate})` : ""}.
              </div>
            )}
            <table className="w-full text-right" style={{ fontSize: scr.mobile ? 11 : 13 }}>
              <thead>
                <tr className="text-slate-200 border-b border-surface-border">
                  <th className="py-2 font-bold">מקור</th>
                  <th className="py-2 font-bold">עובד</th>
                  <th className="py-2 font-bold">עמלה</th>
                  <th className="py-2 font-bold">סכום מכירה</th>
                  <th className="py-2 font-bold">פרטים</th>
                  <th className="py-2 font-bold">סוג</th>
                  <th className="py-2 font-bold">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {displayedSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-surface-border/50">
                    <td className="py-2">
                      <span className="text-[10px]">{sale.source === "auto_sync" ? "🔄" : "✏️"}</span>
                    </td>
                    <td className="py-2">
                      {sale.employee_name ? (
                        <span className="font-semibold text-slate-100">{sale.employee_name}</span>
                      ) : (
                        <span className="badge" style={{ background: "#f59e0b20", color: "#f59e0b", fontSize: 9 }}>
                          ללא שיוך
                        </span>
                      )}
                    </td>
                    <td className="py-2 font-bold" style={{ color: "#22c55e" }}>{formatCurrency(sale.commission_amount)}</td>
                    <td className="py-2 font-bold text-slate-100">{formatCurrency(sale.sale_type === "line" ? (sale.package_price || 0) : (sale.device_sale_amount || 0))}</td>
                    <td className="py-2">
                      <div className="text-slate-100">{sale.sale_type === "line" ? (sale.customer_name || "—") : (sale.device_name || "—")}</div>
                      {(sale.order_id || sale.store_customer_code_snapshot) && (
                        <div className="mt-1 text-[10px] text-slate-300">
                          {sale.order_id ? `#${sale.order_id}` : ""}
                          {sale.order_id && sale.store_customer_code_snapshot ? " · " : ""}
                          {sale.store_customer_code_snapshot || ""}
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      <span className="badge text-[10px]" style={{ background: sale.sale_type === "line" ? "#3b82f620" : "#ef444420", color: sale.sale_type === "line" ? "#60a5fa" : "#f87171" }}>
                        {sale.sale_type === "line" ? "קו" : "מכשיר"}
                      </span>
                    </td>
                    <td className="py-2 text-slate-200">{sale.sale_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Status + Contract Info */}
      <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }}>
        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={handleSync} disabled={syncing} className="btn-primary" style={{ fontSize: 10, padding: "6px 14px", opacity: syncing ? 0.5 : 1 }}>
              {syncing ? "מסנכרן..." : "🔄 סנכרן עכשיו"}
            </button>
            <h3 className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>🔄 סנכרון</h3>
          </div>
          {data.syncInfo ? (
            <div className="text-muted text-[10px] text-right">
              סנכרון אחרון: {new Date(data.syncInfo.lastSync).toLocaleString("he-IL")} | {data.syncInfo.ordersSynced} הזמנות סונכרנו
            </div>
          ) : (
            <div className="text-dim text-[10px] text-right">לא בוצע סנכרון עדיין</div>
          )}
          <div className="flex gap-3 mt-2 text-[10px] text-muted">
            <span>🔄 סנכרון: {s.autoSyncedCount}</span>
            <span>✏️ ידני: {s.manualEntryCount}</span>
          </div>
          {data.historicalSummary.unassignedAutoSyncEmployeeCount > 0 && (
            <div className="mt-3 rounded-xl border border-state-warning/30 bg-state-warning/10 px-3 py-2 text-right">
              <div className="text-[10px] font-bold text-state-warning">
                {data.historicalSummary.unassignedAutoSyncEmployeeCount} מכירות auto-sync עדיין ללא שיוך עובד
              </div>
              <Link href={autoSyncHistoryHref} className="mt-1 inline-block text-[10px] font-bold text-brand">
                פתח היסטוריה לטיפול ←
              </Link>
            </div>
          )}
        </div>

        {/* Contract Info Widget */}
        <div className="card mb-3" style={{ padding: scr.mobile ? 12 : 18, width: scr.mobile ? "100%" : 280 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📄 פרטי הסכם</h3>
          <div className="space-y-1 text-[10px] text-muted text-right">
            <div>תקופת הסכם: מ-01/04/2021</div>
            <div>מתחדש כל 12 חודשים (מקסימום 3 שנים)</div>
            <div>הודעת ביטול: 45 יום מראש</div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-state-success" />
              <span>הסכם פעיל</span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Modal */}
      <Modal open={showTargetModal} onClose={() => setShowTargetModal(false)} title="🎯 הגדרת יעד חודשי">
        <div dir="rtl">
          {isLocked ? (
            <div className="bg-state-warning/10 border border-state-warning/30 rounded-xl px-4 py-3 mb-3 text-[12px] text-state-warning font-bold text-right">
              🔒 היעד לחודש זה ננעל ולא ניתן לעריכה. שחרר את הנעילה כדי לערוך.
            </div>
          ) : (
            <>
              {/* Sales-focused fields first (primary page focus) */}
              <div className="rounded-xl border border-state-success/30 bg-state-success/5 p-3 mb-3">
                <div className="font-bold text-state-success text-[12px] mb-2 text-right">
                  💰 יעדי מכירות (₪)
                </div>
                <FormField label="יעד מכירות חודשי (₪) — סך קווים + מכשירים">
                  <input
                    type="number"
                    className="input"
                    value={targetSalesAmountInput}
                    onChange={(e) => setTargetSalesAmountInput(e.target.value)}
                    placeholder="לדוגמה: 300000"
                  />
                </FormField>
                <FormField label="הוספה ידנית למכירות מכשירים (₪) — אופליין / חיצוני">
                  <input
                    type="number"
                    className="input"
                    value={manualSalesAddOnInput}
                    onChange={(e) => setManualSalesAddOnInput(e.target.value)}
                    placeholder="לדוגמה: 15000 (ערך מכירה, לא עמלה)"
                  />
                  <div className="text-[10px] text-slate-300 mt-1 leading-snug">
                    מטופל כמכירת מכשירים רגילה: מייצר עמלה (5% + בונוס מדרגה כל 50,000₪) שנוספת אוטומטית לעמלות מכשירים ומתקדמת מול יעד העמלות.
                  </div>
                </FormField>
              </div>

              {/* Commission target (still needed, but secondary) */}
              <div className="rounded-xl border border-surface-border bg-surface/50 p-3 mb-3">
                <div className="font-bold text-slate-200 text-[12px] mb-2 text-right">
                  💵 יעדי עמלות
                </div>
                <FormField label="יעד עמלות חודשי (₪)" required>
                  <input
                    type="number"
                    className="input"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="לדוגמה: 15000"
                  />
                </FormField>
                <FormField label="יעד קווים (מספר קווים)">
                  <input
                    type="number"
                    className="input"
                    value={targetLinesCount}
                    onChange={(e) => setTargetLinesCount(e.target.value)}
                    placeholder="לדוגמה: 50"
                  />
                </FormField>
                <FormField label="יעד מכירות מכשירים (מספר מכשירים)">
                  <input
                    type="number"
                    className="input"
                    value={targetDevicesCount}
                    onChange={(e) => setTargetDevicesCount(e.target.value)}
                    placeholder="לדוגמה: 20"
                  />
                </FormField>
              </div>

              <div className="text-slate-300 text-[11px] mb-3">חודש: {month}</div>
              <button onClick={handleSetTarget} className="btn-primary w-full">שמור יעד</button>
            </>
          )}
        </div>
      </Modal>

      {/* Lock Confirm Dialog */}
      <ConfirmDialog
        open={showLockConfirm}
        onClose={() => setShowLockConfirm(false)}
        onConfirm={handleLockToggle}
        title={isLocked ? "🔓 שחרור נעילת יעד" : "🔒 נעילת יעד"}
        message={
          isLocked
            ? "האם לשחרר את נעילת היעד? זה יאפשר עריכה חופשית."
            : "לאחר נעילה לא ניתן יהיה לערוך את היעד. פעולה זו חשובה להשוואה חודשית אמינה. להמשיך?"
        }
      />
    </div>
  );
}
