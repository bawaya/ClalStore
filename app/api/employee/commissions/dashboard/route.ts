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
import {
  calcMonthlySummary,
  calcLoyaltyBonus,
  calcDeviceCommission,
  COMMISSION,
} from "@/lib/commissions/calculator";
import {
  COMMISSION_CONTRACT_TARGET_KEY,
  getCommissionTarget,
  lastDayOfMonth,
} from "@/lib/commissions/ledger";
import { countWorkingDays } from "@/lib/commissions/date-utils";

// Admin-level roles on the PWA see the contract-wide picture (same scope
// as the /admin/commissions page with no employee filter). Regular
// sales / viewer / support users see only their own sales.
const ADMIN_PWA_ROLES = new Set(["admin", "super_admin", "owner"]);

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
    const isAdminScope = ADMIN_PWA_ROLES.has(authed.role);
    // Admin/super_admin users see contract-wide data on the PWA (match
    // the admin screen's unfiltered view). Non-admin employees see only
    // their own sales.
    const scope: "admin" | "employee" = isAdminScope ? "admin" : "employee";
    const targetKeys = isAdminScope
      ? [COMMISSION_CONTRACT_TARGET_KEY, appUserId]
      : [appUserId, COMMISSION_CONTRACT_TARGET_KEY];

    // Helper to conditionally apply the employee filter to a query.
    // `any` is necessary because Supabase's query builder type narrows
    // after each call and we don't want to enumerate all possible types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scopeToEmployee = <T extends { eq: (col: string, val: string) => any }>(
      q: T,
      col: string,
    ): T => (isAdminScope ? q : (q.eq(col, appUserId) as T));

    const [todayRes, monthRes, sanctionsRes, target] = await Promise.all([
      scopeToEmployee(
        db
          .from("commission_sales")
          .select("id, commission_amount, package_price, device_sale_amount, sale_type")
          .is("deleted_at", null)
          .eq("sale_date", todayISO),
        "employee_id",
      ),
      scopeToEmployee(
        db
          .from("commission_sales")
          .select("id, commission_amount, package_price, device_sale_amount, sale_type, loyalty_start_date, loyalty_status, source, sale_date")
          .is("deleted_at", null)
          .gte("sale_date", monthStart)
          .lte("sale_date", monthEnd)
          .order("sale_date", { ascending: false }),
        "employee_id",
      ),
      scopeToEmployee(
        db
          .from("commission_sanctions")
          .select("amount")
          .is("deleted_at", null)
          .gte("sanction_date", monthStart)
          .lte("sanction_date", monthEnd),
        "user_id",
      ),
      getCommissionTarget(db, monthStr, targetKeys),
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

    // Sales values broken out — mirrors admin dashboard so both screens agree.
    const totalLineSalesAmount = monthSales
      .filter((s) => s.sale_type === "line")
      .reduce((sum, s) => sum + Number(s.package_price || 0), 0);
    const autoTrackedDeviceSales = monthSales
      .filter((s) => s.sale_type === "device")
      .reduce((sum, s) => sum + Number(s.device_sale_amount || 0), 0);

    // Manual add-on is treated as a virtual device sale (same rule as admin
    // view): adds to device sales pool, earns 5% base + every-50k milestone.
    const manualSalesAddOn = Number(
      (target as { manual_sales_add_on?: number | null })?.manual_sales_add_on || 0,
    );
    const totalDeviceSalesAmount = autoTrackedDeviceSales + manualSalesAddOn;
    const monthTotalAmount = totalLineSalesAmount + totalDeviceSalesAmount;

    // Delta device commission generated by the add-on — folded into summary
    // so commission totals and pacing reflect it.
    const autoDeviceCalc = calcDeviceCommission(autoTrackedDeviceSales);
    const adjustedDeviceCalc = calcDeviceCommission(totalDeviceSalesAmount);
    const manualAddOnDeviceCommission = manualSalesAddOn > 0
      ? Math.max(0, adjustedDeviceCalc.total - autoDeviceCalc.total)
      : 0;

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

    // Fold the manual add-on's commission into totals, matching admin view.
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

    // Month pacing
    const totalDaysInMonth = new Date(year, nowIL.getMonth() + 1, 0).getDate();
    const daysPassed = nowIL.getDate();
    const monthStartDate = new Date(year, nowIL.getMonth(), 1);
    const endDate = new Date(year, nowIL.getMonth() + 1, 0);
    const todayStart = new Date(year, nowIL.getMonth(), nowIL.getDate());
    const workingDaysLeft = countWorkingDays(todayStart, endDate);
    const totalWorkingDays = countWorkingDays(monthStartDate, endDate);
    const workingDaysElapsed = Math.max(0, totalWorkingDays - workingDaysLeft);
    const safeWorkingElapsed = Math.max(1, workingDaysElapsed);
    const safeWorkingDaysLeft = Math.max(1, workingDaysLeft);

    const targetTotal = Number((target as { target_total?: number })?.target_total || 0);
    const targetSalesAmount = Number(
      (target as { target_sales_amount?: number | null })?.target_sales_amount || 0,
    );

    // SALES-focused gap (primary — admin dashboard uses this)
    const salesRemaining = targetSalesAmount > 0
      ? Math.max(0, targetSalesAmount - monthTotalAmount)
      : 0;
    const salesRequiredPerDay = targetSalesAmount > 0 && workingDaysLeft > 0
      ? Math.ceil(salesRemaining / safeWorkingDaysLeft)
      : 0;
    const salesPerDayPace = Math.round(monthTotalAmount / safeWorkingElapsed);
    const salesProgress = targetSalesAmount > 0
      ? Math.min(100, Math.round((monthTotalAmount / targetSalesAmount) * 100))
      : 0;

    // Commission-focused gap (secondary)
    const commissionRemaining = Math.max(0, targetTotal - summary.netCommission);
    const commissionRequiredPerDay = targetTotal > 0 && workingDaysLeft > 0
      ? Math.ceil(commissionRemaining / safeWorkingDaysLeft)
      : 0;

    // Pacing color — drive from sales progress when sales target set,
    // else fall back to commission progress (matches admin logic).
    const expectedProgress = totalDaysInMonth > 0 ? (daysPassed / totalDaysInMonth) * 100 : 0;
    const primaryProgress = targetSalesAmount > 0
      ? salesProgress
      : (targetTotal > 0 ? Math.round((summary.netCommission / targetTotal) * 100) : 0);
    const pacingColor: "green" | "yellow" | "red" =
      primaryProgress >= expectedProgress
        ? "green"
        : primaryProgress >= expectedProgress * 0.7
          ? "yellow"
          : "red";

    // BACKWARD-COMPAT: the old `remainingAmount` / `dailyRequired` fields
    // used target_total as the target (buggy — that's commission target
    // being compared to sales amount). Keep the old shape so older PWA
    // clients don't break, but the sensible value is salesRemaining /
    // salesRequiredPerDay (or commissionRemaining / commissionRequiredPerDay
    // when only a commission target exists).
    const primaryTarget = targetSalesAmount > 0 ? targetSalesAmount : targetTotal;
    const remainingAmount = targetSalesAmount > 0 ? salesRemaining : commissionRemaining;
    const dailyRequired = targetSalesAmount > 0
      ? salesRequiredPerDay
      : commissionRequiredPerDay;

    // Milestones — now contract-wide + manual add-on, so employees see the
    // same milestone progression as admin when looking at the same scope.
    const currentTotal = totalDeviceSalesAmount;
    const milestonesReached = Math.floor(currentTotal / COMMISSION.DEVICE_MILESTONE);
    const nextMilestoneAt = (milestonesReached + 1) * COMMISSION.DEVICE_MILESTONE;
    const bonusEarned = milestonesReached * COMMISSION.DEVICE_MILESTONE_BONUS;

    return apiSuccess({
      scope,
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
        totalLineSalesAmount,
        totalDeviceSalesAmount,
        autoTrackedDeviceSales,
        manualSalesAddOn,
        manualAddOnDeviceCommission,
        totalCommission: summary.linesCommission + summary.devicesCommission + summary.loyaltyBonus,
        sanctions: summary.totalSanctions,
        netCommission: summary.netCommission,
        // Sales-focused (primary)
        targetSalesAmount,
        salesProgress,
        salesRemaining,
        salesRequiredPerDay,
        salesPerDayPace,
        // Commission-focused (secondary)
        targetCommissionAmount: targetTotal,
        commissionProgress: targetTotal > 0 ? Math.round((summary.netCommission / targetTotal) * 100) : 0,
        commissionRemaining,
        commissionRequiredPerDay,
        workingDaysLeft,
        workingDaysElapsed,
        totalWorkingDays,
        // Legacy fields (kept for backward compat — now point to the sales
        // gap when sales target set, else commission gap)
        target: primaryTarget,
        targetProgress: primaryProgress,
        remainingAmount,
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
