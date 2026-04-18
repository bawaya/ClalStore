import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { calcMonthlySummary, calcLoyaltyBonus } from "@/lib/commissions/calculator";
import { getCommissionTarget, lastDayOfMonth } from "@/lib/commissions/ledger";

/**
 * GET /api/employee/commissions?month=YYYY-MM
 *
 * Returns the authenticated employee's own commission data for a given month.
 * Filtered BY the authed app-user id (not by admin token).
 */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    // Default month = current month in Asia/Jerusalem
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("month")?.trim();
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const defaultMonth = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : defaultMonth;

    const monthStart = `${month}-01`;
    const monthEnd = lastDayOfMonth(month);

    const appUserId = authed.appUserId;

    // Parallel fetches, all scoped to this employee
    const [salesRes, sanctionsRes, target, salesDocsRes] = await Promise.all([
      db
        .from("commission_sales")
        .select(
          "id, sale_date, sale_type, customer_name, device_name, package_price, device_sale_amount, commission_amount, source, loyalty_start_date, loyalty_status",
        )
        .eq("employee_id", appUserId)
        .is("deleted_at", null)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .order("sale_date", { ascending: false })
        .limit(2000),
      db
        .from("commission_sanctions")
        .select("id, sanction_date, sanction_type, amount, description, has_sale_offset")
        .eq("user_id", appUserId)
        .is("deleted_at", null)
        .gte("sanction_date", monthStart)
        .lte("sanction_date", monthEnd)
        .order("sanction_date", { ascending: false })
        .limit(500),
      getCommissionTarget(db, month, [appUserId]),
      db
        .from("sales_docs")
        .select("id, doc_uuid, sale_type, status, sale_date, total_amount, notes, created_at, rejection_reason, order_id")
        .eq("employee_key", appUserId)
        .is("deleted_at", null)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (salesRes.error) return safeError(salesRes.error, "EmployeeCommissions/sales");
    if (sanctionsRes.error) return safeError(sanctionsRes.error, "EmployeeCommissions/sanctions");
    if (salesDocsRes.error) return safeError(salesDocsRes.error, "EmployeeCommissions/docs");

    const sales = salesRes.data || [];
    const sanctions = sanctionsRes.data || [];
    const salesDocs = salesDocsRes.data || [];

    // Compute loyalty bonuses from this employee's active lines
    const loyaltyBonuses = sales
      .filter((s: any) => s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active")
      .reduce((sum: number, line: any) => sum + calcLoyaltyBonus(line.loyalty_start_date).earnedSoFar, 0);

    const summary = calcMonthlySummary(sales as any, sanctions as any, loyaltyBonuses, target as any);

    return apiSuccess({
      month,
      employee: { id: appUserId, name: authed.name, email: authed.email || null },
      summary,
      sales,
      sanctions,
      sales_docs: salesDocs,
      target: target
        ? {
            target_total: (target as any).target_total || 0,
            target_lines_count: (target as any).target_lines_count || 0,
            target_devices_count: (target as any).target_devices_count || 0,
          }
        : null,
    });
  } catch (err) {
    return safeError(err, "EmployeeCommissions", "خطأ في السيرفر", 500);
  }
}
