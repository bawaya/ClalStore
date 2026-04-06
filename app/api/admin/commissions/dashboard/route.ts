import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calcMonthlySummary, calcDeviceCommission, calcLoyaltyBonus, calcLineCommission, COMMISSION } from "@/lib/commissions/calculator";
import { getLastSyncInfo } from "@/lib/commissions/sync-orders";

// OPTIONS preflight — handled by middleware OPEN_CORS_PATHS, but keep as fallback
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

// Count working days (excluding Saturdays / Shabbat)
function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 6) count++; // 6 = Saturday
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function GET(req: NextRequest) {
  // Dual auth: bearer token (local app) OR admin session (admin panel)
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const validToken = process.env.COMMISSION_API_TOKEN;

  let authed = false;
  if (bearerToken && validToken && bearerToken === validToken) {
    authed = true;
  } else {
    const auth = await requireAdmin(req);
    if (!(auth instanceof NextResponse)) authed = true;
    else return auth; // Return 401/403 from requireAdmin
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminSupabase();
  if (!db) return apiError("DB unavailable", 500);

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const employeeId = searchParams.get("employee_id"); // optional: filter by employee

  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  // Build queries with optional employee filter
  let salesQuery = db.from("commission_sales")
    .select("*")
    .gte("sale_date", monthStart)
    .lte("sale_date", monthEnd)
    .order("sale_date", { ascending: false });

  let sanctionsQuery = db.from("commission_sanctions")
    .select("*")
    .gte("sanction_date", monthStart)
    .lte("sanction_date", monthEnd);

  let targetQuery = db.from("commission_targets")
    .select("*")
    .eq("month", month);

  if (employeeId) {
    salesQuery = salesQuery.eq("employee_id", employeeId);
    sanctionsQuery = sanctionsQuery.eq("employee_id", employeeId);
    targetQuery = targetQuery.eq("user_id", employeeId);
  }

  // Fetch sales, sanctions, target in parallel
  const [salesRes, sanctionsRes, targetRes, syncInfo] = await Promise.all([
    salesQuery,
    sanctionsQuery,
    targetQuery.maybeSingle(),
    getLastSyncInfo(),
  ]);

  if (salesRes.error) return apiError(salesRes.error.message, 500);

  interface SaleRow { id: number; sale_type: string; sale_date: string; commission_amount: number; device_sale_amount: number; loyalty_start_date: string | null; loyalty_status: string | null; source: string; customer_name: string | null; device_name: string | null; package_price: number; }
  interface SanctionRow { amount: number; }
  interface TargetRow { target_total: number; target_lines_amount: number; target_devices_amount: number; target_lines_count: number; target_devices_count: number; is_locked: boolean; locked_at: string | null; }

  const sales: SaleRow[] = salesRes.data || [];
  const sanctions: SanctionRow[] = sanctionsRes.data || [];
  const target = targetRes.data as TargetRow | null;

  // Calculate device milestones from total device sales this month
  const totalDeviceSales = sales
    .filter((s: SaleRow) => s.sale_type === "device")
    .reduce((sum: number, s: SaleRow) => sum + (s.device_sale_amount || 0), 0);
  const deviceCalc = calcDeviceCommission(totalDeviceSales);

  // Calculate loyalty bonuses from active lines
  const activeLines = sales.filter((s: SaleRow) => s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active");
  const loyaltyBonuses = activeLines.reduce((sum: number, line: SaleRow) => {
    const lb = calcLoyaltyBonus(line.loyalty_start_date!);
    return sum + lb.earnedSoFar;
  }, 0);

  const summary = calcMonthlySummary(sales, sanctions, loyaltyBonuses, target);

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
  const [yearStr, monthStr] = month.split("-");
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

  // Pace calculations
  const safeWorkingElapsed = Math.max(1, workingDaysElapsed);
  const safeWorkingDaysLeft = Math.max(1, workingDaysLeft);

  const linesPerDayPace = linesSalesCount / safeWorkingElapsed;
  const devicesAmountPerDayPace = totalDeviceSalesAmount / safeWorkingElapsed;

  // Target-based calculations
  const targetLinesCount = target?.target_lines_count || 0;
  const targetDevicesCount = target?.target_devices_count || 0;
  const targetTotal = target?.target_total || 0;

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

  // Overall commission pace
  const commissionPerDayPace = summary.netCommission / safeWorkingElapsed;
  const commissionRequiredPerDay = targetTotal > 0 && workingDaysLeft > 0
    ? Math.max(0, targetTotal - summary.netCommission) / safeWorkingDaysLeft
    : 0;
  const commissionExpectedPace = totalWorkingDays > 0 ? targetTotal / totalWorkingDays : 0;
  const overallPaceStatus = commissionPerDayPace >= commissionExpectedPace
    ? (commissionPerDayPace > commissionExpectedPace * 1.1 ? "ahead" : "on_track")
    : "behind";

  const paceTracking = {
    daysInMonth,
    daysElapsed,
    daysLeft,
    totalWorkingDays,
    workingDaysElapsed,
    workingDaysLeft,
    isCurrentMonth,
    overallPaceStatus,
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

  if (isCurrentMonth && overallPaceStatus === "behind" && targetTotal > 0) {
    alerts.push({
      text: `קצב נוכחי: ${Math.round(commissionPerDayPace)}₪/יום — נדרש: ${Math.round(commissionRequiredPerDay)}₪/יום`,
      color: "#ef4444",
    });
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

  // If viewing aggregate (no employee), also compute owner profit
  let ownerProfit = null;
  if (!employeeId) {
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
  }

  return apiSuccess({
    summary,
    deviceCalc,
    dailyBreakdown,
    alerts,
    syncInfo,
    recentSales: sales.slice(0, 10),
    month,
    employeeId: employeeId || null,
    ownerProfit,
    paceTracking,
    targetDetails: target ? {
      target_total: target.target_total || 0,
      target_lines_count: target.target_lines_count || 0,
      target_devices_count: target.target_devices_count || 0,
      target_lines_amount: target.target_lines_amount || 0,
      target_devices_amount: target.target_devices_amount || 0,
      is_locked: target.is_locked || false,
      locked_at: target.locked_at || null,
    } : null,
  });
}
