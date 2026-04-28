import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calcMonthlySummary, calcDeviceCommission, calcLoyaltyBonus } from "@/lib/commissions/calculator";
import { getLastSyncInfo } from "@/lib/commissions/sync-orders";
import {
  getCommissionTarget,
  resolveCommissionEmployeeFilter,
} from "@/lib/commissions/ledger";
import { countWorkingDays, lastDayOfMonth } from "@/lib/commissions/date-utils";

export async function GET(req: NextRequest) {
  // Cookie-only auth — the legacy bearer-token path was decommissioned
  // along with the standalone HOT Mobile commission HTML apps.
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const db = createAdminSupabase();
  if (!db) return apiError("DB unavailable", 500);

  try {
  const { searchParams } = new URL(req.url);
  const requestedMonth = searchParams.get("month")?.trim() || null;
  const scope = await resolveCommissionEmployeeFilter(db, {
    employeeId: searchParams.get("employee_id"),
    employeeName: searchParams.get("employee_name"),
    employeeKey: searchParams.get("employee_key"),
    employeeToken: searchParams.get("employee_token"),
    targetKey: searchParams.get("target_key"),
  });

  let month = requestedMonth;
  if (!month) {
    let latestSaleMonthQuery = db.from("commission_sales")
      .select("sale_date")
      .is("deleted_at", null)
      .order("sale_date", { ascending: false })
      .limit(1);

    if (scope.notFound) {
      latestSaleMonthQuery = latestSaleMonthQuery.eq("id", -1);
    } else if (scope.employeeId) {
      latestSaleMonthQuery = latestSaleMonthQuery.eq("employee_id", scope.employeeId);
    } else if (scope.employeeName) {
      latestSaleMonthQuery = latestSaleMonthQuery.eq("employee_name", scope.employeeName);
    }

    const { data: latestSales, error: latestSalesError } = await latestSaleMonthQuery;
    if (latestSalesError) {
      console.error("Commission dashboard latest-month error:", latestSalesError.message);
      return apiError("فشل في تحديد الشهر الافتراضي", 500);
    }

    month = latestSales?.[0]?.sale_date?.slice(0, 7) || new Date().toISOString().slice(0, 7);
  }

  const resolvedMonth = month || new Date().toISOString().slice(0, 7);

  const monthStart = `${resolvedMonth}-01`;
  const monthEnd = lastDayOfMonth(resolvedMonth);

  // Build queries with optional employee filter
  let salesQuery = db.from("commission_sales")
    .select("*")
    .is("deleted_at", null)
    .gte("sale_date", monthStart)
    .lte("sale_date", monthEnd)
    .order("sale_date", { ascending: false })
    .limit(5000);

  let sanctionsQuery = db.from("commission_sanctions")
    .select("*")
    .is("deleted_at", null)
    .gte("sanction_date", monthStart)
    .lte("sanction_date", monthEnd)
    .limit(5000);

  let historicalRecentSalesQuery = db.from("commission_sales")
    .select("*")
    .is("deleted_at", null)
    .order("sale_date", { ascending: false })
    .limit(10);

  let unassignedAutoSyncEmployeeQuery = db.from("commission_sales")
    .select("id", { count: "exact", head: true })
    .eq("source", "auto_sync")
    .is("deleted_at", null)
    .is("employee_id", null);

  if (scope.notFound) {
    salesQuery = salesQuery.eq("id", -1);
    sanctionsQuery = sanctionsQuery.eq("id", -1);
    historicalRecentSalesQuery = historicalRecentSalesQuery.eq("id", -1);
    unassignedAutoSyncEmployeeQuery = unassignedAutoSyncEmployeeQuery.eq("id", -1);
  } else if (scope.employeeId) {
    salesQuery = salesQuery.eq("employee_id", scope.employeeId);
    sanctionsQuery = sanctionsQuery.eq("employee_id", scope.employeeId);
    historicalRecentSalesQuery = historicalRecentSalesQuery.eq("employee_id", scope.employeeId);
    unassignedAutoSyncEmployeeQuery = unassignedAutoSyncEmployeeQuery.eq("employee_id", scope.employeeId);
  } else if (scope.employeeName) {
    salesQuery = salesQuery.eq("employee_name", scope.employeeName);
    sanctionsQuery = sanctionsQuery.eq("employee_name", scope.employeeName);
    historicalRecentSalesQuery = historicalRecentSalesQuery.eq("employee_name", scope.employeeName);
    unassignedAutoSyncEmployeeQuery = unassignedAutoSyncEmployeeQuery.eq("employee_name", scope.employeeName);
  }

  // Fetch sales, sanctions, target in parallel
  const [salesRes, sanctionsRes, targetRes, syncInfo, historicalRecentSalesRes, unassignedAutoSyncEmployeeRes] = await Promise.all([
    salesQuery,
    sanctionsQuery,
    getCommissionTarget(db, resolvedMonth, scope.targetKeys),
    getLastSyncInfo(),
    historicalRecentSalesQuery,
    unassignedAutoSyncEmployeeQuery,
  ]);

  if (salesRes.error) {
    console.error("Commission dashboard DB error:", salesRes.error.message);
    return apiError("فشل في جلب بيانات لوحة التحكم", 500);
  }

  interface SaleRow { id: number; sale_type: string; sale_date: string; commission_amount: number; device_sale_amount: number; loyalty_start_date: string | null; loyalty_status: string | null; source: string; customer_name: string | null; device_name: string | null; package_price: number; employee_name?: string | null; employee_id?: string | null; }
  interface SanctionRow { amount: number; }
  interface TargetRow { target_total: number; target_lines_amount: number; target_devices_amount: number; target_lines_count: number; target_devices_count: number; is_locked: boolean; locked_at: string | null; target_sales_amount: number | null; manual_sales_add_on: number | null; }

  const sales: SaleRow[] = salesRes.data || [];
  const sanctions: SanctionRow[] = sanctionsRes.data || [];
  const target = targetRes as TargetRow | null;
  const historicalRecentSales: SaleRow[] = historicalRecentSalesRes.data || [];
  const unassignedAutoSyncEmployeeCount = unassignedAutoSyncEmployeeRes.count || 0;

  // Calculate device milestones from total device sales this month.
  // IMPORTANT: manual_sales_add_on is treated as a virtual device sale:
  // its ₪ value is added to the device sales pool, so it participates in
  // the DEVICE_RATE base commission (5%) AND in every-50k milestones. The
  // commission it generates is then folded into devicesCommission /
  // netCommission below, so it also reduces the commission-target gap.
  const autoTrackedDeviceSales = sales
    .filter((s: SaleRow) => s.sale_type === "device")
    .reduce((sum: number, s: SaleRow) => sum + (s.device_sale_amount || 0), 0);
  const rawManualSalesAddOn = Number(target?.manual_sales_add_on || 0);
  const totalDeviceSales = autoTrackedDeviceSales + rawManualSalesAddOn;
  const deviceCalc = calcDeviceCommission(totalDeviceSales);

  // Incremental commission generated by the manual add-on alone =
  // deviceCalc(auto + manual) − deviceCalc(auto). Taking the delta rather
  // than rate × add-on correctly accounts for milestone bonuses that flip
  // on because of the add-on (e.g. 45k auto + 10k manual crosses 50k).
  const manualAddOnDeviceCommission = rawManualSalesAddOn > 0
    ? Math.max(0, deviceCalc.total - calcDeviceCommission(autoTrackedDeviceSales).total)
    : 0;

  // Calculate loyalty bonuses from active lines
  const activeLines = sales.filter((s: SaleRow) => s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active");
  const loyaltyBonuses = activeLines.reduce((sum: number, line: SaleRow) => {
    const lb = calcLoyaltyBonus(line.loyalty_start_date!);
    return sum + lb.earnedSoFar;
  }, 0);

  const summary = calcMonthlySummary(sales, sanctions, loyaltyBonuses, target);

  // Fold the manual add-on's device commission into the summary so
  // downstream pace / target-gap math picks it up automatically.
  if (manualAddOnDeviceCommission > 0) {
    summary.devicesCommission += manualAddOnDeviceCommission;
    summary.grossCommission += manualAddOnDeviceCommission;
    summary.netCommission += manualAddOnDeviceCommission;
    if (summary.targetAmount > 0) {
      summary.targetProgress = Math.min(
        100,
        Math.round((summary.netCommission / summary.targetAmount) * 100),
      );
    }
  }

  // Daily breakdown
  const dailyMap: Record<string, { lines: number; devices: number }> = {};
  for (const s of sales) {
    if (!dailyMap[s.sale_date]) dailyMap[s.sale_date] = { lines: 0, devices: 0 };
    if (s.sale_type === "line") dailyMap[s.sale_date].lines += s.commission_amount || 0;
    else dailyMap[s.sale_date].devices += s.commission_amount || 0;
  }
  const dailyBreakdown = Object.entries(dailyMap)
    .map(([date, amounts]) => ({ date, ...amounts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ===== Pace Tracking =====
  const [yearStr, monthStr] = resolvedMonth.split("-");
  const monthYear = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const monthStartDate = new Date(monthYear, monthNum - 1, 1);
  const monthEndDate = new Date(monthYear, monthNum, 0); // last day of month
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysInMonth = monthEndDate.getDate();

  const totalWorkingDays = countWorkingDays(monthStartDate, monthEndDate);
  const isCurrentMonth = now.getFullYear() === monthYear && (now.getMonth() + 1) === monthNum;

  // Days elapsed (including today)
  let daysElapsed = 0;
  let workingDaysElapsed = 0;
  let workingDaysLeft = 0;
  let daysLeft = 0;

  if (isCurrentMonth) {
    daysElapsed = today.getDate();
    workingDaysElapsed = countWorkingDays(monthStartDate, today);
    workingDaysLeft = countWorkingDays(new Date(today.getTime() + 86400000), monthEndDate);
    daysLeft = daysInMonth - today.getDate();
  } else if (today > monthEndDate) {
    daysElapsed = daysInMonth;
    workingDaysElapsed = totalWorkingDays;
    workingDaysLeft = 0;
    daysLeft = 0;
  } else {
    daysElapsed = 0;
    workingDaysElapsed = 0;
    workingDaysLeft = totalWorkingDays;
    daysLeft = daysInMonth;
  }

  // Count actual sales
  const linesSalesCount = sales.filter((s: SaleRow) => s.sale_type === "line").length;
  const devicesSalesCount = sales.filter((s: SaleRow) => s.sale_type === "device").length;
  const totalDeviceSalesAmount = totalDeviceSales;

  // Sales VALUES (not commissions) — the page is re-oriented around these.
  // Line "sale value" = package_price × 1 (single subscription value sold).
  // Device "sale value" = device_sale_amount (the device price tag).
  // totalDeviceSalesAmount already includes manual add-on (see above).
  const totalLineSalesAmount = sales
    .filter((s: SaleRow) => s.sale_type === "line")
    .reduce((sum: number, s: SaleRow) => sum + (s.package_price || 0), 0);
  const manualSalesAddOn = rawManualSalesAddOn;
  const autoTrackedSalesAmount = totalLineSalesAmount + autoTrackedDeviceSales;
  const totalSalesAmount = autoTrackedSalesAmount + manualSalesAddOn;

  // Pace calculations
  const safeWorkingElapsed = Math.max(1, workingDaysElapsed);
  const safeWorkingDaysLeft = Math.max(1, workingDaysLeft);

  const linesPerDayPace = linesSalesCount / safeWorkingElapsed;
  const devicesAmountPerDayPace = totalDeviceSalesAmount / safeWorkingElapsed;

  // Target-based calculations
  const targetLinesCount = target?.target_lines_count || 0;
  const targetDevicesCount = target?.target_devices_count || 0;
  const targetTotal = target?.target_total || 0;
  const targetSalesAmount = Number(target?.target_sales_amount || 0);

  // Lines need box
  const linesRemaining = Math.max(0, targetLinesCount - linesSalesCount);
  const linesRequiredPerDay = workingDaysLeft > 0 ? linesRemaining / safeWorkingDaysLeft : 0;
  const linesExpectedPace = totalWorkingDays > 0 ? targetLinesCount / totalWorkingDays : 0;
  const linesPaceStatus = linesPerDayPace >= linesExpectedPace ? (linesPerDayPace > linesExpectedPace * 1.1 ? "ahead" : "on_track") : "behind";

  // Devices need box
  const devicesRemaining = Math.max(0, targetDevicesCount - devicesSalesCount);
  const devicesRequiredPerDay = workingDaysLeft > 0 ? devicesRemaining / safeWorkingDaysLeft : 0;
  const devicesExpectedPace = totalWorkingDays > 0 ? targetDevicesCount / totalWorkingDays : 0;
  const devicesPerDayPace = devicesSalesCount / safeWorkingElapsed;
  const devicesPaceStatus = devicesPerDayPace >= devicesExpectedPace ? (devicesPerDayPace > devicesExpectedPace * 1.1 ? "ahead" : "on_track") : "behind";

  // Overall commission pace (kept for backward compat + secondary info card)
  const commissionPerDayPace = summary.netCommission / safeWorkingElapsed;
  const commissionRequiredPerDay = targetTotal > 0 && workingDaysLeft > 0
    ? Math.max(0, targetTotal - summary.netCommission) / safeWorkingDaysLeft
    : 0;
  const commissionExpectedPace = totalWorkingDays > 0 ? targetTotal / totalWorkingDays : 0;

  // Overall SALES pace (the primary focus of the page now)
  const salesPerDayPace = totalSalesAmount / safeWorkingElapsed;
  const salesRequiredPerDay = targetSalesAmount > 0 && workingDaysLeft > 0
    ? Math.max(0, targetSalesAmount - totalSalesAmount) / safeWorkingDaysLeft
    : 0;
  const salesExpectedPace = targetSalesAmount > 0 && totalWorkingDays > 0
    ? targetSalesAmount / totalWorkingDays
    : 0;
  const salesProgress = targetSalesAmount > 0
    ? Math.min(100, Math.round((totalSalesAmount / targetSalesAmount) * 100))
    : 0;

  // Pace status is driven by SALES when a sales target is set, else falls
  // back to commission pace so existing "ahead/on_track/behind" chip still
  // works for targets-only-commission mode.
  const overallPaceStatus = targetSalesAmount > 0
    ? (salesPerDayPace >= salesExpectedPace
        ? (salesPerDayPace > salesExpectedPace * 1.1 ? "ahead" : "on_track")
        : "behind")
    : (commissionPerDayPace >= commissionExpectedPace
        ? (commissionPerDayPace > commissionExpectedPace * 1.1 ? "ahead" : "on_track")
        : "behind");

  const paceTracking = {
    daysInMonth,
    daysElapsed,
    daysLeft,
    totalWorkingDays,
    workingDaysElapsed,
    workingDaysLeft,
    isCurrentMonth,
    overallPaceStatus,
    // Sales-focused pace (primary)
    salesPerDayPace: Math.round(salesPerDayPace),
    salesRequiredPerDay: Math.round(salesRequiredPerDay),
    salesExpectedPace: Math.round(salesExpectedPace),
    totalSalesAmount: Math.round(totalSalesAmount),
    autoTrackedSalesAmount: Math.round(autoTrackedSalesAmount),
    manualSalesAddOn: Math.round(manualSalesAddOn),
    // Commission generated by treating manual_sales_add_on as a virtual
    // device sale (DEVICE_RATE base + milestone deltas). UI shows this so
    // admin can see exactly how the add-on moves the commission target.
    manualAddOnDeviceCommission: Math.round(manualAddOnDeviceCommission),
    targetSalesAmount: Math.round(targetSalesAmount),
    salesProgress,
    totalLineSalesAmount: Math.round(totalLineSalesAmount),
    totalDeviceSalesAmount: Math.round(totalDeviceSalesAmount),
    autoTrackedDeviceSales: Math.round(autoTrackedDeviceSales),
    // Commission pace (kept for secondary display)
    commissionPerDayPace: Math.round(commissionPerDayPace),
    commissionRequiredPerDay: Math.round(commissionRequiredPerDay),
    commissionExpectedPace: Math.round(commissionExpectedPace),
    lines: {
      target: targetLinesCount,
      achieved: linesSalesCount,
      remaining: linesRemaining,
      perDayPace: Math.round(linesPerDayPace * 10) / 10,
      requiredPerDay: Math.round(linesRequiredPerDay * 10) / 10,
      expectedPace: Math.round(linesExpectedPace * 10) / 10,
      paceStatus: linesPaceStatus,
    },
    devices: {
      target: targetDevicesCount,
      achieved: devicesSalesCount,
      remaining: devicesRemaining,
      perDayPace: Math.round(devicesPerDayPace * 10) / 10,
      requiredPerDay: Math.round(devicesRequiredPerDay * 10) / 10,
      expectedPace: Math.round(devicesExpectedPace * 10) / 10,
      paceStatus: devicesPaceStatus,
      totalSalesAmount: totalDeviceSalesAmount,
      amountPerDayPace: Math.round(devicesAmountPerDayPace),
    },
  };

  // Smart alerts
  const alerts: { text: string; color: string }[] = [];

  if (target && summary.targetProgress < 100) {
    const remaining = summary.targetAmount - summary.netCommission;
    if (daysLeft > 0) {
      const perDay = Math.ceil(remaining / daysLeft);
      const linesPerDayNeeded = Math.ceil(perDay / 100);
      alerts.push({
        text: `כדי להגיע ליעד, צריך למכור ~${linesPerDayNeeded} קווים ביום`,
        color: summary.targetProgress >= 70 ? "#22c55e" : summary.targetProgress >= 40 ? "#eab308" : "#ef4444",
      });
    }
  }

  // Second alert — now oriented around SALES VALUE per day, not commission.
  // If a sales target is set, we show the sales-per-day gap. If not, fall
  // back to the old commission-per-day message so we still say something
  // useful when admin only configured a commission target.
  if (isCurrentMonth && overallPaceStatus === "behind") {
    if (targetSalesAmount > 0) {
      alerts.push({
        text: `קצב מכירות נוכחי: ${Math.round(salesPerDayPace).toLocaleString()}₪/יום — נדרש: ${Math.round(salesRequiredPerDay).toLocaleString()}₪/יום במכירות`,
        color: "#ef4444",
      });
    } else if (targetTotal > 0) {
      alerts.push({
        text: `קצב עמלות נוכחי: ${Math.round(commissionPerDayPace).toLocaleString()}₪/יום — נדרש: ${Math.round(commissionRequiredPerDay).toLocaleString()}₪/יום בעמלות`,
        color: "#ef4444",
      });
    }
  }

  if (deviceCalc.nextMilestoneAt < 15000) {
    alerts.push({
      text: `נותרו ₪${deviceCalc.nextMilestoneAt.toLocaleString()} למדרגה הבאה (בונוס ₪2,500)`,
      color: "#3b82f6",
    });
  }

  // Lines nearing loyalty end
  const nearingLoyaltyEnd = activeLines.filter((l: SaleRow) => {
    if (!l.loyalty_start_date) return false;
    const lb = calcLoyaltyBonus(l.loyalty_start_date);
    return lb.isInLoyaltyPeriod && lb.daysRemaining <= 30;
  }).length;
  if (nearingLoyaltyEnd > 0) {
    alerts.push({
      text: `${nearingLoyaltyEnd} קווים קרובים לסוף תקופת נאמנות`,
      color: "#f97316",
    });
  }

  // If viewing aggregate (no employee), also compute owner profit + employee breakdown
  let ownerProfit = null;
  let employeeBreakdown: { name: string; lines: number; devices: number; commission: number; pct: number }[] = [];
  if (!scope.employeeId && !scope.employeeName) {
    const totalContractCommission = sales.reduce((sum: number, s: SaleRow) => sum + ((s as any).contract_commission || s.commission_amount || 0), 0);
    const totalEmployeeCommission = sales.reduce((sum: number, s: SaleRow) => {
      if (!(s as any).employee_id) return sum;
      return sum + (s.commission_amount || 0);
    }, 0);
    ownerProfit = {
      contractTotal: totalContractCommission,
      employeeCosts: totalEmployeeCommission,
      netProfit: totalContractCommission - totalEmployeeCommission,
    };

    // Build per-employee breakdown
    const byEmp: Record<string, { lines: number; devices: number; commission: number }> = {};
    for (const s of sales) {
      const name = (s as any).employee_name || "ללא שיוך";
      if (!byEmp[name]) byEmp[name] = { lines: 0, devices: 0, commission: 0 };
      if (s.sale_type === "line") byEmp[name].lines++;
      else byEmp[name].devices++;
      byEmp[name].commission += s.commission_amount || 0;
    }
    const totalComm = Object.values(byEmp).reduce((s, e) => s + e.commission, 0) || 1;
    employeeBreakdown = Object.entries(byEmp)
      .map(([name, d]) => ({ name, ...d, pct: Math.round((d.commission / totalComm) * 100) }))
      .sort((a, b) => b.commission - a.commission);
  }

  return apiSuccess({
    summary,
    deviceCalc,
    dailyBreakdown,
    alerts,
    syncInfo,
    recentSales: sales.slice(0, 10),
    historicalRecentSales,
    historicalSummary: {
      latestSaleDate: historicalRecentSales[0]?.sale_date || null,
      unassignedAutoSyncEmployeeCount,
    },
    month: resolvedMonth,
    employeeId: scope.employeeId,
    employeeName: scope.employeeName,
    ownerProfit,
    employeeBreakdown,
    paceTracking,
    targetDetails: target ? {
      target_total: target.target_total || 0,
      target_lines_count: target.target_lines_count || 0,
      target_devices_count: target.target_devices_count || 0,
      target_lines_amount: target.target_lines_amount || 0,
      target_devices_amount: target.target_devices_amount || 0,
      target_sales_amount: Number(target.target_sales_amount || 0),
      manual_sales_add_on: Number(target.manual_sales_add_on || 0),
      is_locked: target.is_locked || false,
      locked_at: target.locked_at || null,
    } : null,
  });
  } catch (err) {
    console.error("[CommissionDashboard]", err);
    return apiError("خطأ داخلي في لوحة التحكم", 500);
  }
}
