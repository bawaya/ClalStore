/**
 * GET /api/employee/commissions/dashboard
 *
 * Merged daily dashboard for the unified PWA home screen.
 * Returns today's snapshot + month-to-date + milestone progress.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { calcMonthlySummary, calcLoyaltyBonus, COMMISSION } from "@/lib/commissions/calculator";
import { getCommissionTarget, lastDayOfMonth } from "@/lib/commissions/ledger";
import { countWorkingDays } from "@/lib/commissions/date-utils";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const year = nowIL.getFullYear();
    const month = String(nowIL.getMonth() + 1).padStart(2, "0");
    const day = String(nowIL.getDate()).padStart(2, "0");
    const todayISO = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;
    const monthStart = `${monthStr}-01`;
    const monthEnd = lastDayOfMonth(monthStr);

    const appUserId = authed.appUserId;

    const [todayRes, monthRes, sanctionsRes, target] = await Promise.all([
      db
        .from("commission_sales")
        .select("id, commission_amount, package_price, device_sale_amount, sale_type")
        .eq("employee_id", appUserId)
        .is("deleted_at", null)
        .eq("sale_date", todayISO),
      db
        .from("commission_sales")
        .select("id, commission_amount, package_price, device_sale_amount, sale_type, loyalty_start_date, loyalty_status, source, sale_date")
        .eq("employee_id", appUserId)
        .is("deleted_at", null)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .order("sale_date", { ascending: false }),
      db
        .from("commission_sanctions")
        .select("amount")
        .eq("user_id", appUserId)
        .is("deleted_at", null)
        .gte("sanction_date", monthStart)
        .lte("sanction_date", monthEnd),
      getCommissionTarget(db, monthStr, [appUserId]),
    ]);

    if (todayRes.error) return safeError(todayRes.error, "dashboard/today");
    if (monthRes.error) return safeError(monthRes.error, "dashboard/month");
    if (sanctionsRes.error) return safeError(sanctionsRes.error, "dashboard/sanctions");

    type SaleRow = {
      id: number;
      commission_amount: number | null;
      package_price: number | null;
      device_sale_amount: number | null;
      sale_type: string;
      loyalty_start_date?: string | null;
      loyalty_status?: string | null;
      source?: string | null;
      sale_date?: string | null;
    };
    const todaySales: SaleRow[] = (todayRes.data || []) as SaleRow[];
    const monthSales: SaleRow[] = (monthRes.data || []) as SaleRow[];
    const sanctions = sanctionsRes.data || [];

    const saleAmount = (s: { sale_type: string; package_price: number | null; device_sale_amount: number | null }) =>
      s.sale_type === "line" ? Number(s.package_price || 0) : Number(s.device_sale_amount || 0);

    const todayTotalAmount = todaySales.reduce((sum: number, s: SaleRow) => sum + saleAmount(s), 0);
    const todayCommission = todaySales.reduce(
      (sum: number, s: SaleRow) => sum + Number(s.commission_amount || 0),
      0,
    );

    const monthTotalAmount = monthSales.reduce((sum: number, s: SaleRow) => sum + saleAmount(s), 0);
    const loyaltyBonuses = monthSales
      .filter((s: SaleRow) =>
        s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active",
      )
      .reduce((sum: number, line: SaleRow) => sum + calcLoyaltyBonus(line.loyalty_start_date!).earnedSoFar, 0);

    const summary = calcMonthlySummary(
      monthSales as never,
      sanctions as never,
      loyaltyBonuses,
      target as never,
    );

    // Month pacing
    const totalDaysInMonth = new Date(year, nowIL.getMonth() + 1, 0).getDate();
    const daysPassed = nowIL.getDate();
    const endDate = new Date(year, nowIL.getMonth() + 1, 0);
    const todayStart = new Date(year, nowIL.getMonth(), nowIL.getDate());
    const workingDaysLeft = countWorkingDays(todayStart, endDate);

    const targetTotal = Number((target as { target_total?: number })?.target_total || 0);
    const remainingAmount = Math.max(0, targetTotal - monthTotalAmount);
    const dailyRequired =
      workingDaysLeft > 0 ? Math.ceil(remainingAmount / workingDaysLeft) : remainingAmount;

    const expectedProgress = totalDaysInMonth > 0 ? (daysPassed / totalDaysInMonth) * 100 : 0;
    const actualProgress = targetTotal > 0 ? (monthTotalAmount / targetTotal) * 100 : 0;
    const pacingColor: "green" | "yellow" | "red" =
      actualProgress >= expectedProgress
        ? "green"
        : actualProgress >= expectedProgress * 0.7
          ? "yellow"
          : "red";

    // Milestones (contract-wide threshold)
    const currentTotal = monthTotalAmount;
    const milestonesReached = Math.floor(currentTotal / COMMISSION.DEVICE_MILESTONE);
    const nextMilestoneAt = (milestonesReached + 1) * COMMISSION.DEVICE_MILESTONE;
    const bonusEarned = milestonesReached * COMMISSION.DEVICE_MILESTONE_BONUS;

    return apiSuccess({
      today: {
        date: todayISO,
        salesCount: todaySales.length,
        totalAmount: todayTotalAmount,
        commission: todayCommission,
      },
      month: {
        month: monthStr,
        salesCount: monthSales.length,
        totalAmount: monthTotalAmount,
        totalCommission: summary.linesCommission + summary.devicesCommission + summary.loyaltyBonus,
        sanctions: summary.totalSanctions,
        netCommission: summary.netCommission,
        target: targetTotal,
        targetProgress: Math.round(actualProgress),
        remainingAmount,
        workingDaysLeft,
        dailyRequired,
        pacingColor,
      },
      milestones: {
        currentTotal,
        nextMilestoneAt,
        milestonesReached,
        bonusEarned,
      },
      recentSales: monthSales.slice(0, 5),
    });
  } catch (err) {
    return safeError(err, "EmployeeDashboard", "خطأ في السيرفر", 500);
  }
}
