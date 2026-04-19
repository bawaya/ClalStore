/**
 * POST /api/admin/sales-requests/:id/reject
 * Super-admin rejects a pending/needs_info request with a reason.
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
    const reason = typeof (body as { reason?: string }).reason === "string"
      ? (body as { reason: string }).reason.trim()
      : "";
    if (!reason) return apiError("يجب كتابة سبب الرفض", 400);

    const { data: existing } = await db
      .from("sales_requests")
      .select("id, employee_id, status")
      .eq("id", requestId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return apiError("الطلب غير موجود", 404);
    const st = (existing as { status: string }).status;
    if (st !== "pending" && st !== "needs_info") {
      return apiError(`لا يمكن رفض طلب بحالة ${st}`, 409);
    }

    const { error } = await db
      .from("sales_requests")
      .update({
        status: "rejected",
        review_note: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
      })
      .eq("id", requestId);
    if (error) return safeError(error, "reject/update");

    await logEvent(db, {
      request_id: requestId,
      event_type: "rejected",
      actor_id: reviewerId,
      actor_role: adminAuth.role,
      message: reason,
    });

    void logEmployeeActivity(db, {
      employeeId: (existing as { employee_id: string }).employee_id,
      eventType: "sales_request_rejected",
      title: "تم رفض طلبك",
      description: reason.length > 140 ? reason.slice(0, 137) + "..." : reason,
      metadata: { request_id: requestId },
    });

    return apiSuccess({ id: requestId, status: "rejected" });
  } catch (err) {
    return safeError(err, "AdminSalesRequestReject", "فشل في رفض الطلب", 500);
  }
}
