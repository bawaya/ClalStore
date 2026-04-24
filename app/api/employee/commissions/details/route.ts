/**
 * GET /api/employee/commissions/details?month=YYYY-MM
 *
 * Per-sale breakdown for the authed employee — used by the detailed
 * commissions page (/sales-pwa/commissions) to show the full calculation
 * for each row.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import {
  COMMISSION_CONTRACT_TARGET_KEY,
  getCommissionTarget,
  lastDayOfMonth,
} from "@/lib/commissions/ledger";
import { COMMISSION, calcDeviceCommission } from "@/lib/commissions/calculator";
import { countWorkingDays } from "@/lib/commissions/date-utils";

const ADMIN_PWA_ROLES = new Set(["admin", "super_admin", "owner"]);

type RateSnapshot = {
  line_multiplier?: number;
  device_rate?: number;
  device_milestone_bonus?: number;
  appliance_rate?: number;
  appliance_milestone_bonus?: number;
  min_package_price?: number;
};

function explainLine(amount: number, snap: RateSnapshot | null): string {
  const empMult = snap?.line_multiplier ?? COMMISSION.LINE_MULTIPLIER;
  const contractTotal = (amount * COMMISSION.LINE_MULTIPLIER).toFixed(2);
  const empTotal = (amount * empMult).toFixed(2);
  return `${amount} × ${COMMISSION.LINE_MULTIPLIER} = ${contractTotal} (contract) | ${amount} × ${empMult} = ${empTotal} (employee)`;
}

function explainDevice(amount: number, snap: RateSnapshot | null): string {
  const empRate = snap?.device_rate ?? COMMISSION.DEVICE_RATE;
  const contractTotal = (amount * COMMISSION.DEVICE_RATE).toFixed(2);
  const empTotal = (amount * empRate).toFixed(2);
  const contractPct = (COMMISSION.DEVICE_RATE * 100).toFixed(1);
  const empPct = (empRate * 100).toFixed(1);
  return `${amount} × ${contractPct}% = ${contractTotal} (contract) | ${amount} × ${empPct}% = ${empTotal} (employee)`;
}

function explainAppliance(amount: number, snap: RateSnapshot | null): string {
  const empRate = snap?.appliance_rate ?? COMMISSION.APPLIANCE_RATE;
  const contractTotal = (amount * COMMISSION.APPLIANCE_RATE).toFixed(2);
  const empTotal = (amount * empRate).toFixed(2);
  const contractPct = (COMMISSION.APPLIANCE_RATE * 100).toFixed(1);
  const empPct = (empRate * 100).toFixed(1);
  return `${amount} × ${contractPct}% = ${contractTotal} (contract) | ${amount} × ${empPct}% = ${empTotal} (employee)`;
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("month")?.trim();
    const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const defaultMonth = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : defaultMonth;
    const monthStart = `${month}-01`;
    const monthEnd = lastDayOfMonth(month);

    const isAdminScope = ADMIN_PWA_ROLES.has(authed.role);
    const scope: "admin" | "employee" = isAdminScope ? "admin" : "employee";
    const targetKeys = isAdminScope
      ? [COMMISSION_CONTRACT_TARGET_KEY, authed.appUserId]
      : [authed.appUserId, COMMISSION_CONTRACT_TARGET_KEY];

    let salesQuery = db
      .from("commission_sales")
      .select(
        "id, sale_date, sale_type, customer_name, customer_phone, device_name, package_price, device_sale_amount, commission_amount, contract_commission, source, source_sales_doc_id, source_pipeline_deal_id, rate_snapshot",
      )
      .is("deleted_at", null)
      .gte("sale_date", monthStart)
      .lte("sale_date", monthEnd)
      .order("sale_date", { ascending: false })
      .limit(2000);
    if (!isAdminScope) salesQuery = salesQuery.eq("employee_id", authed.appUserId);

    let sanctionsQuery = db
      .from("commission_sanctions")
      .select("id, sanction_date, sanction_type, amount, description, has_sale_offset")
      .is("deleted_at", null)
      .gte("sanction_date", monthStart)
      .lte("sanction_date", monthEnd)
      .order("sanction_date", { ascending: false });
    if (!isAdminScope) sanctionsQuery = sanctionsQuery.eq("user_id", authed.appUserId);

    const [salesRes, sanctionsRes, target] = await Promise.all([
      salesQuery,
      sanctionsQuery,
      getCommissionTarget(db, month, targetKeys),
    ]);

    if (salesRes.error) return safeError(salesRes.error, "details/sales");
    if (sanctionsRes.error) return safeError(sanctionsRes.error, "details/sanctions");

    type SaleDetailsRow = {
      id: number;
      sale_type: string;
      sale_date: string;
      package_price: number | null;
      device_sale_amount: number | null;
      contract_commission: number | null;
      commission_amount: number | null;
      rate_snapshot: unknown;
      source: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      device_name: string | null;
      source_sales_doc_id: number | null;
      source_pipeline_deal_id: number | null;
    };
    const sales = ((salesRes.data || []) as SaleDetailsRow[]).map((s: SaleDetailsRow) => {
      const amount =
        s.sale_type === "line" ? Number(s.package_price || 0) : Number(s.device_sale_amount || 0);
      const contractAmount = Number(s.contract_commission || 0);
      const employeeAmount = Number(s.commission_amount || 0);
      const snap = s.rate_snapshot as RateSnapshot | null;
      return {
        id: s.id,
        date: s.sale_date,
        type: s.sale_type,
        amount,
        source: s.source,
        commission: {
          contractAmount,
          employeeAmount,
          ownerProfit: contractAmount - employeeAmount,
          calculation:
            s.sale_type === "line"
              ? explainLine(amount, snap)
              : s.sale_type === "appliance"
                ? explainAppliance(amount, snap)
                : explainDevice(amount, snap),
        },
        customer: s.customer_name,
        phone: s.customer_phone,
        deviceName: s.device_name,
        status: "active",
        rateSnapshot: snap,
        sourceSalesDocId: s.source_sales_doc_id,
        sourcePipelineDealId: s.source_pipeline_deal_id,
      };
    });

    // Milestones touched this month (auto-tracked sales only in the per-row
    // walk; manual add-on milestones are appended below).
    let running = 0;
    const milestones: Array<{ threshold: number; hit_on: string; bonus: number }> = [];
    for (const s of [...sales].reverse()) {
      const before = Math.floor(running / COMMISSION.DEVICE_MILESTONE);
      running += s.amount;
      const after = Math.floor(running / COMMISSION.DEVICE_MILESTONE);
      if (after > before) {
        for (let m = before + 1; m <= after; m++) {
          milestones.push({
            threshold: m * COMMISSION.DEVICE_MILESTONE,
            hit_on: s.date as string,
            bonus: COMMISSION.DEVICE_MILESTONE_BONUS,
          });
        }
      }
    }

    // ===== Server-computed summary (mirrors admin dashboard) =====
    const totalLineSalesAmount = sales
      .filter((s) => s.type === "line")
      .reduce((sum, s) => sum + s.amount, 0);
    const autoTrackedDeviceSales = sales
      .filter((s) => s.type === "device")
      .reduce((sum, s) => sum + s.amount, 0);

    const manualSalesAddOn = Number(
      (target as { manual_sales_add_on?: number | null })?.manual_sales_add_on || 0,
    );
    const totalDeviceSalesAmount = autoTrackedDeviceSales + manualSalesAddOn;
    const totalSalesAmount = totalLineSalesAmount + totalDeviceSalesAmount;

    // Manual add-on may cross a milestone threshold — emit a synthetic
    // milestone entry so the page shows the bonus. The milestone is
    // attributed to the last day of the month (no specific sale row).
    if (manualSalesAddOn > 0) {
      const before = Math.floor(autoTrackedDeviceSales / COMMISSION.DEVICE_MILESTONE);
      const after = Math.floor(totalDeviceSalesAmount / COMMISSION.DEVICE_MILESTONE);
      for (let m = before + 1; m <= after; m++) {
        milestones.push({
          threshold: m * COMMISSION.DEVICE_MILESTONE,
          hit_on: monthEnd,
          bonus: COMMISSION.DEVICE_MILESTONE_BONUS,
        });
      }
    }

    const autoDeviceCalc = calcDeviceCommission(autoTrackedDeviceSales);
    const adjustedDeviceCalc = calcDeviceCommission(totalDeviceSalesAmount);
    const manualAddOnDeviceCommission = manualSalesAddOn > 0
      ? Math.max(0, adjustedDeviceCalc.total - autoDeviceCalc.total)
      : 0;

    const linesCommission = sales
      .filter((s) => s.type === "line")
      .reduce((sum, s) => sum + s.commission.employeeAmount, 0);
    const autoDevicesCommission = sales
      .filter((s) => s.type === "device")
      .reduce((sum, s) => sum + s.commission.employeeAmount, 0);
    const devicesCommission = autoDevicesCommission + manualAddOnDeviceCommission;
    const sanctionsTotal = ((sanctionsRes.data || []) as Array<{ amount: number | null }>).reduce(
      (sum: number, s: { amount: number | null }) => sum + Number(s.amount || 0),
      0,
    );
    const grossCommission = linesCommission + devicesCommission;
    const netCommission = grossCommission - sanctionsTotal;

    // Target + pacing
    const [year, monthNum] = month.split("-").map((n) => parseInt(n, 10));
    const monthStartDate = new Date(year, monthNum - 1, 1);
    const monthEndDate = new Date(year, monthNum, 0);
    const isCurrentMonth = nowIL.getFullYear() === year && (nowIL.getMonth() + 1) === monthNum;
    const totalWorkingDays = countWorkingDays(monthStartDate, monthEndDate);
    const todayStart = new Date(nowIL.getFullYear(), nowIL.getMonth(), nowIL.getDate());
    const workingDaysLeft = isCurrentMonth
      ? countWorkingDays(todayStart, monthEndDate)
      : (nowIL > monthEndDate ? 0 : totalWorkingDays);
    const workingDaysElapsed = Math.max(0, totalWorkingDays - workingDaysLeft);
    const safeWorkingDaysLeft = Math.max(1, workingDaysLeft);

    const targetCommissionAmount = Number(
      (target as { target_total?: number | null })?.target_total || 0,
    );
    const targetSalesAmount = Number(
      (target as { target_sales_amount?: number | null })?.target_sales_amount || 0,
    );
    const salesRemaining = targetSalesAmount > 0
      ? Math.max(0, targetSalesAmount - totalSalesAmount)
      : 0;
    const salesRequiredPerDay = targetSalesAmount > 0 && workingDaysLeft > 0
      ? Math.ceil(salesRemaining / safeWorkingDaysLeft)
      : 0;
    const salesProgress = targetSalesAmount > 0
      ? Math.min(100, Math.round((totalSalesAmount / targetSalesAmount) * 100))
      : 0;
    const commissionRemaining = Math.max(0, targetCommissionAmount - netCommission);
    const commissionRequiredPerDay = targetCommissionAmount > 0 && workingDaysLeft > 0
      ? Math.ceil(commissionRemaining / safeWorkingDaysLeft)
      : 0;
    const commissionProgress = targetCommissionAmount > 0
      ? Math.min(100, Math.round((netCommission / targetCommissionAmount) * 100))
      : 0;

    return apiSuccess({
      month,
      scope,
      sales,
      sanctions: sanctionsRes.data || [],
      milestones,
      summary: {
        totalLineSalesAmount,
        autoTrackedDeviceSales,
        manualSalesAddOn,
        totalDeviceSalesAmount,
        totalSalesAmount,
        linesCommission,
        autoDevicesCommission,
        manualAddOnDeviceCommission,
        devicesCommission,
        sanctionsTotal,
        grossCommission,
        netCommission,
        targetSalesAmount,
        targetCommissionAmount,
        salesProgress,
        salesRemaining,
        salesRequiredPerDay,
        commissionProgress,
        commissionRemaining,
        commissionRequiredPerDay,
        workingDaysLeft,
        workingDaysElapsed,
        totalWorkingDays,
      },
    });
  } catch (err) {
    return safeError(err, "EmployeeDetails", "خطأ في السيرفر", 500);
  }
}
