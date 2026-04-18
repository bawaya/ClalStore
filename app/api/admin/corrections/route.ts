/**
 * GET /api/admin/corrections
 *
 * Admin view of all commission correction requests across employees.
 * Supports filtering by status.
 */

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ("status" in auth) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = db
      .from("commission_correction_requests")
      .select(
        "id, employee_id, commission_sale_id, sales_doc_id, request_type, description, status, admin_response, resolved_by, resolved_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (status && ["pending", "approved", "rejected", "resolved"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return safeError(error, "admin/corrections/list");

    // Enrich with employee names
    const rows = (data || []) as Array<{ employee_id: string } & Record<string, unknown>>;
    const employeeIds = [...new Set(rows.map((r) => r.employee_id))];
    const userNames = new Map<string, string>();
    if (employeeIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, name")
        .in("id", employeeIds);
      const userRows = (users || []) as Array<{ id: string; name: string | null }>;
      for (const u of userRows) userNames.set(u.id, u.name || "Unknown");
    }

    return apiSuccess({
      requests: rows.map((r) => ({
        ...r,
        employeeName: userNames.get(r.employee_id) || "Unknown",
      })),
    });
  } catch (err) {
    return safeError(err, "AdminCorrections/GET", "خطأ في السيرفر", 500);
  }
}
