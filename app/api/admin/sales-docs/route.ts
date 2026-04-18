import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { withPermission } from "@/lib/admin/auth";
import { lastDayOfMonth } from "@/lib/commissions/date-utils";

export const GET = withPermission("commissions", "manage", async (req: NextRequest, db) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeKey = searchParams.get("employee_key");
    const month = searchParams.get("month"); // YYYY-MM
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to"); // YYYY-MM-DD
    const source = searchParams.get("source");
    const search = searchParams.get("search")?.trim();

    let q = db
      .from("sales_docs")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (status) q = q.eq("status", status);
    if (employeeKey) q = q.eq("employee_key", employeeKey);
    if (source) q = q.eq("source", source);
    if (month) {
      q = q.gte("sale_date", `${month}-01`).lte("sale_date", lastDayOfMonth(month));
    }
    if (from) q = q.gte("sale_date", from);
    if (to) q = q.lte("sale_date", to);
    if (search) {
      q = q.or(
        `notes.ilike.%${search}%,order_id.ilike.%${search}%,customer_id.ilike.%${search}%,employee_key.ilike.%${search}%`
      );
    }

    const { data, error, count } = await q;
    if (error) return apiError("فشل في جلب البيانات", 500);

    return apiSuccess({ docs: data || [] }, { total: count ?? (data || []).length });
  } catch (err: unknown) {
    return safeError(err, "Admin SalesDocs GET", "خطأ في السيرفر", 500);
  }
});

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

