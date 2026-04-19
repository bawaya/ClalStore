/**
 * GET /api/employee/commissions/chart?range=6months
 *
 * Last N months of sales, commissions, and targets for the authed employee.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { COMMISSION_CONTRACT_TARGET_KEY, lastDayOfMonth } from "@/lib/commissions/ledger";

const ADMIN_PWA_ROLES = new Set(["admin", "super_admin", "owner"]);

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const rangeStr = searchParams.get("range") || "6months";
    const monthsCount = parseInt(rangeStr.replace(/\D/g, "") || "6", 10);
    const n = Math.min(Math.max(monthsCount, 1), 24);

    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );

    const months: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(nowIL.getFullYear(), nowIL.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const earliest = `${months[0]}-01`;
    const latest = lastDayOfMonth(months[months.length - 1]);

    const isAdminScope = ADMIN_PWA_ROLES.has(authed.role);

    let salesQuery = db
      .from("commission_sales")
      .select("sale_date, sale_type, package_price, device_sale_amount, commission_amount")
      .is("deleted_at", null)
      .gte("sale_date", earliest)
      .lte("sale_date", latest)
      .limit(10000);
    if (!isAdminScope) salesQuery = salesQuery.eq("employee_id", authed.appUserId);

    // Target per month: prefer employee-specific, fall back to contract
    // target. The simplest query is to fetch BOTH keys for ALL months and
    // resolve per-month in the loop.
    const targetUserIds = isAdminScope
      ? [COMMISSION_CONTRACT_TARGET_KEY]
      : [authed.appUserId, COMMISSION_CONTRACT_TARGET_KEY];

    const [salesRes, targetsRes] = await Promise.all([
      salesQuery,
      db
        .from("commission_targets")
        .select("month, target_total, user_id")
        .in("user_id", targetUserIds)
        .in("month", months),
    ]);

    if (salesRes.error) return safeError(salesRes.error, "chart/sales");
    if (targetsRes.error) return safeError(targetsRes.error, "chart/targets");

    const saleAmount = (s: { sale_type: string; package_price: number | null; device_sale_amount: number | null }) =>
      s.sale_type === "line" ? Number(s.package_price || 0) : Number(s.device_sale_amount || 0);

    const salesByMonth = new Map<string, { amount: number; commission: number }>();
    for (const m of months) salesByMonth.set(m, { amount: 0, commission: 0 });
    for (const s of salesRes.data || []) {
      const m = String(s.sale_date).slice(0, 7);
      const bucket = salesByMonth.get(m);
      if (!bucket) continue;
      bucket.amount += saleAmount(s as never);
      bucket.commission += Number(s.commission_amount || 0);
    }

    // Per month, prefer employee-specific target; fall back to contract.
    const targetsByMonth = new Map<string, number>();
    const targetRows = (targetsRes.data || []) as Array<{ month: string; target_total: number | null; user_id: string | null }>;
    for (const m of months) {
      const personal = targetRows.find((r) => r.month === m && r.user_id === authed.appUserId);
      if (personal) {
        targetsByMonth.set(m, Number(personal.target_total || 0));
        continue;
      }
      const contract = targetRows.find((r) => r.month === m && r.user_id === COMMISSION_CONTRACT_TARGET_KEY);
      if (contract) {
        targetsByMonth.set(m, Number(contract.target_total || 0));
      }
    }

    return apiSuccess({
      scope: isAdminScope ? "admin" : "employee",
      months,
      sales: months.map((m) => salesByMonth.get(m)?.amount || 0),
      commissions: months.map((m) => salesByMonth.get(m)?.commission || 0),
      targets: months.map((m) => targetsByMonth.get(m) || 0),
    });
  } catch (err) {
    return safeError(err, "EmployeeChart", "خطأ في السيرفر", 500);
  }
}
