/**
 * Admin single-request fetch. Returns the full row + children + event
 * timeline + employee display name.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId)) return apiError("invalid id", 400);

    const [reqRes, devRes, pkgRes, evRes] = await Promise.all([
      db.from("sales_requests").select("*").eq("id", requestId).is("deleted_at", null).maybeSingle(),
      db.from("sales_request_devices").select("*").eq("request_id", requestId).order("position"),
      db.from("sales_request_packages").select("*").eq("request_id", requestId).order("position"),
      db.from("sales_request_events").select("*").eq("request_id", requestId).order("created_at", { ascending: true }),
    ]);

    if (reqRes.error) return safeError(reqRes.error, "admin/sales-request/get");
    if (!reqRes.data) return apiError("الطلب غير موجود", 404);

    const row = reqRes.data as { employee_id: string; reviewed_by: string | null };

    // Resolve employee + reviewer names
    const userIds = Array.from(new Set([row.employee_id, row.reviewed_by].filter(Boolean) as string[]));
    const userNames = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await db.from("users").select("id, name, role, email").in("id", userIds);
      for (const u of (users || []) as Array<{ id: string; name: string | null }>) {
        userNames.set(u.id, u.name || "");
      }
    }

    return apiSuccess({
      request: {
        ...reqRes.data,
        employee_name: userNames.get(row.employee_id) || null,
        reviewer_name: row.reviewed_by ? userNames.get(row.reviewed_by) || null : null,
      },
      devices: devRes.data || [],
      packages: pkgRes.data || [],
      events: evRes.data || [],
    });
  } catch (err) {
    return safeError(err, "AdminSalesRequestGet", "خطأ داخلي", 500);
  }
}
