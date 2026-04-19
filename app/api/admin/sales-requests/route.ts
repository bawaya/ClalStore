/**
 * Admin sales-requests list + pending-count.
 *
 *   GET /api/admin/sales-requests?status=pending&limit=50
 *   GET /api/admin/sales-requests?count=pending
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

const VALID_STATUSES = new Set(["draft", "pending", "needs_info", "approved", "rejected"]);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const countMode = searchParams.get("count");

    // Quick count endpoint for the sidebar badge
    if (countMode) {
      const targetStatus = VALID_STATUSES.has(countMode) ? countMode : "pending";
      const { count, error } = await db
        .from("sales_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", targetStatus)
        .is("deleted_at", null);
      if (error) return safeError(error, "sales-requests/count");
      return apiSuccess({ status: targetStatus, count: count ?? 0 });
    }

    const statusFilter = searchParams.get("status");
    const employeeFilter = searchParams.get("employee_id");
    const limit = Math.min(200, Number(searchParams.get("limit") || 50));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    let query = db
      .from("sales_requests")
      .select(
        // Join employee name via the FK would require a foreign-table select — easier to do a parallel lookup
        "id, employee_id, status, customer_name, customer_id_number, contact_number, delivery_address, locality_name, bank_name, bank_code, bank_branch, bank_account, total_devices_amount, total_packages_monthly, total_devices_count, total_lines_count, submitted_at, reviewed_at, reviewed_by, review_note, created_at, updated_at",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter && VALID_STATUSES.has(statusFilter)) {
      query = query.eq("status", statusFilter);
    } else if (statusFilter === "active") {
      // Convenience: everything that needs attention
      query = query.in("status", ["pending", "needs_info"]);
    }
    if (employeeFilter) query = query.eq("employee_id", employeeFilter);

    const { data, count, error } = await query;
    if (error) return safeError(error, "sales-requests/list");

    const rows = (data || []) as Array<{ employee_id: string }>;
    const employeeIds = Array.from(new Set(rows.map((r) => r.employee_id))).filter(Boolean);
    const employeesMap = new Map<string, string>();
    if (employeeIds.length > 0) {
      const { data: emps } = await db
        .from("users")
        .select("id, name")
        .in("id", employeeIds);
      for (const e of (emps || []) as Array<{ id: string; name: string | null }>) {
        employeesMap.set(e.id, e.name || "");
      }
    }

    return apiSuccess({
      requests: rows.map((r) => ({
        ...r,
        employee_name: employeesMap.get(r.employee_id) || null,
      })),
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    return safeError(err, "AdminSalesRequestsList", "خطأ داخلي", 500);
  }
}
