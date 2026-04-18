/**
 * GET /api/employee/activity?limit=50&offset=0
 *
 * Returns the authed employee's activity timeline — paginated for infinite scroll.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const { data, error, count } = await db
      .from("employee_activity_log")
      .select("id, event_type, title, description, metadata, created_at", { count: "exact" })
      .eq("employee_id", authed.appUserId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return safeError(error, "activity/list");

    return apiSuccess({
      activities: data || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + (data?.length || 0)) < (count || 0),
    });
  } catch (err) {
    return safeError(err, "EmployeeActivity", "خطأ في السيرفر", 500);
  }
}
