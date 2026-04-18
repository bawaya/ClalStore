/**
 * PUT /api/admin/corrections/[id]
 *
 * Admin responds to a correction request — approve, reject, or mark resolved.
 */

import { NextRequest } from "next/server";
import { requireAdmin, hasPermission, logAudit } from "@/lib/admin/auth";
import { actorId } from "@/lib/admin/actor";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { logEmployeeActivity } from "@/lib/employee/activity-log";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["approved", "rejected", "resolved"]),
  adminResponse: z.string().min(2).max(2000),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if ("status" in auth) return auth;

    if (!hasPermission(auth.role, "commissions", "manage")) {
      return apiError("ليس لديك صلاحية للرد على طلبات التصحيح", 403);
    }

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await ctx.params;
    const reqId = Number(id);
    if (!reqId || Number.isNaN(reqId)) return apiError("Invalid id", 400);

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resolverId = actorId(auth as { appUserId?: string });
    const now = new Date().toISOString();

    const { data, error } = await db
      .from("commission_correction_requests")
      .update({
        status: parsed.data.status,
        admin_response: parsed.data.adminResponse,
        resolved_by: resolverId,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", reqId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) return safeError(error, "admin/corrections/update");
    if (!data) return apiError("الطلب تم الرد عليه مسبقاً أو غير موجود", 409);

    void logEmployeeActivity(db, {
      employeeId: data.employee_id as string,
      eventType: "correction_resolved",
      title:
        parsed.data.status === "approved"
          ? "طلب تصحيح موافَق عليه"
          : parsed.data.status === "rejected"
            ? "طلب تصحيح مرفوض"
            : "طلب تصحيح مكتمل",
      description: parsed.data.adminResponse.slice(0, 200),
      metadata: { correction_id: data.id, status: parsed.data.status },
    });

    await logAudit(db, {
      userId: resolverId,
      userName: auth.name || "Admin",
      userRole: auth.role,
      action: "resolve_correction",
      module: "commissions",
      entityType: "correction_request",
      entityId: String(reqId),
      details: { status: parsed.data.status, response: parsed.data.adminResponse },
    });

    return apiSuccess({ request: data });
  } catch (err) {
    return safeError(err, "AdminCorrections/PUT", "خطأ في السيرفر", 500);
  }
}
