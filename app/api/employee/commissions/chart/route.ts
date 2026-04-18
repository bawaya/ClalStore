/**
 * GET /api/employee/commissions/chart?range=6months
 *
 * Last N months of sales, commissions, and targets for the authed employee.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { lastDayOfMonth } from "@/lib/commissions/ledger";

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

    const [salesRes, targetsRes] = await Promise.all([
      db
        .from("commission_sales")
        .select("sale_date, sale_type, package_price, device_sale_amount, commission_amount")
        .eq("employee_id", authed.appUserId)
        .is("deleted_at", null)
        .gte("sale_date", earliest)
        .lte("sale_date", latest)
        .limit(10000),
      db
        .from("commission_targets")
        .select("month, target_total")
        .eq("user_id", authed.appUserId)
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

    const targetsByMonth = new Map<string, number>();
    for (const t of targetsRes.data || []) {
      targetsByMonth.set(t.month, Number(t.target_total || 0));
    }

    return apiSuccess({
      months,
      sales: months.map((m) => salesByMonth.get(m)?.amount || 0),
      commissions: months.map((m) => salesByMonth.get(m)?.commission || 0),
      targets: months.map((m) => targetsByMonth.get(m) || 0),
    });
  } catch (err) {
    return safeError(err, "EmployeeChart", "خطأ في السيرفر", 500);
  }
}
