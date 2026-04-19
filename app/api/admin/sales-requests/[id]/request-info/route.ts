/**
 * POST /api/admin/sales-requests/:id/request-info
 * Super-admin asks the employee for more details. Status → needs_info.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { logEvent } from "@/lib/sales-requests/service";
import { logEmployeeActivity } from "@/lib/employee/activity-log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const adminAuth = auth as unknown as { role: string; id: string; appUserId?: string };
    if (adminAuth.role !== "super_admin") {
      return apiError("الإجراء يتطلب صلاحية Super Admin", 403);
    }
    const reviewerId = adminAuth.appUserId || adminAuth.id;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId)) return apiError("invalid id", 400);

    const body = await req.json().catch(() => ({}));
    const message = typeof (body as { message?: string }).message === "string"
      ? (body as { message: string }).message.trim()
      : "";
    if (!message) return apiError("اكتب السؤال للموظف حتى يعرف ما المطلوب", 400);

    // Ensure request is in a valid source state
    const { data: existing } = await db
      .from("sales_requests")
      .select("id, employee_id, status")
      .eq("id", requestId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return apiError("الطلب غير موجود", 404);
    const st = (existing as { status: string }).status;
    if (st !== "pending" && st !== "needs_info") {
      return apiError(`لا يمكن طلب تفاصيل على طلب بحالة ${st}`, 409);
    }

    const { error: updateError } = await db
      .from("sales_requests")
      .update({
        status: "needs_info",
        review_note: message,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
      })
      .eq("id", requestId);
    if (updateError) return safeError(updateError, "request-info/update");

    await logEvent(db, {
      request_id: requestId,
      event_type: "info_requested",
      actor_id: reviewerId,
      actor_role: adminAuth.role,
      message,
    });

    void logEmployeeActivity(db, {
      employeeId: (existing as { employee_id: string }).employee_id,
      eventType: "sales_request_info_requested",
      title: "الإدارة تطلب توضيحات على طلبك",
      description: message.length > 140 ? message.slice(0, 137) + "..." : message,
      metadata: { request_id: requestId },
    });

    return apiSuccess({ id: requestId, status: "needs_info" });
  } catch (err) {
    return safeError(err, "AdminSalesRequestInfoRequest", "فشل في طلب التفاصيل", 500);
  }
}
