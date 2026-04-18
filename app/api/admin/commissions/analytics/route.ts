import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calcMonthlySummary, calcLoyaltyBonus } from "@/lib/commissions/calculator";
import {
  COMMISSION_CONTRACT_TARGET_KEY,
  getCommissionTarget,
} from "@/lib/commissions/ledger";
import { lastDayOfMonth } from "@/lib/commissions/date-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

interface MonthlyAnalytics {
  month: string;
  targetTotal: number;
  linesCommission: number;
  devicesCommission: number;
  loyaltyBonus: number;
  grossCommission: number;
  totalSanctions: number;
  netCommission: number;
  targetProgress: number;
  linesSalesCount: number;
  devicesSalesCount: number;
  totalSalesCount: number;
}

export const GET = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const rangeMonths = parseInt(searchParams.get("months") || "12");

  // Generate last N months
  const months: string[] = [];
  const now = new Date();
  for (let i = rangeMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const startMonth = months[0];
  const endMonth = months[months.length - 1];
  const startDate = `${startMonth}-01`;
  const endDate = lastDayOfMonth(endMonth);

  // Fetch all data across the range
  const [salesRes, sanctionsRes, targetsRes] = await Promise.all([
    db.from("commission_sales")
      .select("*")
      .is("deleted_at", null)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate)
      .order("sale_date", { ascending: true }),
    db.from("commission_sanctions")
      .select("*")
      .is("deleted_at", null)
      .gte("sanction_date", startDate)
      .lte("sanction_date", endDate),
    Promise.all(
      months.map(async (month) => ({
        month,
        target: await getCommissionTarget(db, month, [COMMISSION_CONTRACT_TARGET_KEY]),
      })),
    ),
  ]);

  if (salesRes.error) {
    console.error("Commission analytics DB error:", salesRes.error.message);
    return apiError("فشل في جلب بيانات التحليلات", 500);
  }

  const allSales = salesRes.data || [];
  const allSanctions = sanctionsRes.data || [];
  const allTargets = new Map(
    (targetsRes || []).map((entry) => [entry.month, entry.target || null]),
  );

  // Build monthly analytics
  const monthlyData: MonthlyAnalytics[] = months.map((month) => {
    const monthStart = `${month}-01`;
    const monthEnd = lastDayOfMonth(month);

    const sales = allSales.filter((s) => s.sale_date >= monthStart && s.sale_date <= monthEnd);
    const sanctions = allSanctions.filter((s) => s.sanction_date >= monthStart && s.sanction_date <= monthEnd);
    const target = allTargets.get(month) || null;

    const activeLines = sales.filter((s) => s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active");
    const loyaltyBonuses = activeLines.reduce((sum, line) => {
      const lb = calcLoyaltyBonus(line.loyalty_start_date!);
      return sum + lb.earnedSoFar;
    }, 0);

    const summary = calcMonthlySummary(sales, sanctions, loyaltyBonuses, target);

    const linesSalesCount = sales.filter((s) => s.sale_type === "line").length;
    const devicesSalesCount = sales.filter((s) => s.sale_type === "device").length;

    return {
      month,
      targetTotal: summary.targetAmount,
      linesCommission: summary.linesCommission,
      devicesCommission: summary.devicesCommission,
      loyaltyBonus: summary.loyaltyBonus,
      grossCommission: summary.grossCommission,
      totalSanctions: summary.totalSanctions,
      netCommission: summary.netCommission,
      targetProgress: summary.targetProgress,
      linesSalesCount,
      devicesSalesCount,
      totalSalesCount: linesSalesCount + devicesSalesCount,
    };
  });

  // KPIs
  const totalCommissions = monthlyData.reduce((sum, m) => sum + m.netCommission, 0);
  const monthsWithTarget = monthlyData.filter((m) => m.targetTotal > 0);
  const avgTargetAchievement = monthsWithTarget.length > 0
    ? Math.round(monthsWithTarget.reduce((sum, m) => sum + m.targetProgress, 0) / monthsWithTarget.length)
    : 0;
  const bestMonth = monthlyData.reduce((best, m) => m.netCommission > best.netCommission ? m : best, monthlyData[0]);
  const totalSalesCount = monthlyData.reduce((sum, m) => sum + m.totalSalesCount, 0);
  const totalSanctions = monthlyData.reduce((sum, m) => sum + m.totalSanctions, 0);
  const totalLoyaltyBonuses = monthlyData.reduce((sum, m) => sum + m.loyaltyBonus, 0);

  // Quarterly aggregation
  const quarters: Record<string, { label: string; months: MonthlyAnalytics[]; netCommission: number; targetTotal: number; targetProgress: number; salesCount: number; sanctions: number }> = {};
  for (const md of monthlyData) {
    const [y, m] = md.month.split("-");
    const q = Math.ceil(parseInt(m) / 3);
    const qKey = `${y}-Q${q}`;
    const qLabel = `Q${q} ${y}`;
    if (!quarters[qKey]) {
      quarters[qKey] = { label: qLabel, months: [], netCommission: 0, targetTotal: 0, targetProgress: 0, salesCount: 0, sanctions: 0 };
    }
    quarters[qKey].months.push(md);
    quarters[qKey].netCommission += md.netCommission;
    quarters[qKey].targetTotal += md.targetTotal;
    quarters[qKey].salesCount += md.totalSalesCount;
    quarters[qKey].sanctions += md.totalSanctions;
  }
  // Calculate quarterly target progress
  for (const q of Object.values(quarters)) {
    q.targetProgress = q.targetTotal > 0 ? Math.min(100, Math.round((q.netCommission / q.targetTotal) * 100)) : 0;
  }

  return apiSuccess({
    monthly: monthlyData,
    quarterly: Object.values(quarters),
    kpi: {
      totalCommissions,
      avgTargetAchievement,
      bestMonth: bestMonth ? { month: bestMonth.month, amount: bestMonth.netCommission } : null,
      totalSalesCount,
      totalSanctions,
      totalLoyaltyBonuses,
    },
  });
});
