/**
 * POST /api/admin/sales-docs/[id]/cancel
 *
 * Manager cancels a sale + its commission (decision 1 updated).
 *
 * Flow:
 *   1. Permission check (manager / super_admin with commissions:manage)
 *   2. Atomic status transition to 'cancelled' (can't double-cancel)
 *   3. Soft-delete linked commission_sales rows (via cancelCommissionsByDoc)
 *   4. Recalculate device milestones for the affected month
 *   5. Audit trail event
 *
 * DB trigger check_month_lock prevents cancellation if the month is locked.
 */

import { NextRequest } from "next/server";
import { requireAdmin, hasPermission, logAudit } from "@/lib/admin/auth";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { cancelCommissionsByDoc } from "@/lib/commissions/register";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().min(3).max(2000, "السبب طويل جداً"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if ("status" in auth) return auth;

    if (!hasPermission(auth.role, "commissions", "manage")) {
      return apiError("ليس لديك صلاحية إلغاء عملية", 403);
    }

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await ctx.params;
    const docId = Number(id);
    if (!docId || Number.isNaN(docId)) return apiError("Invalid id", 400);

    const body = await req.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join("; ");
      return apiError(message || "Invalid payload", 400);
    }
    const { reason } = parsed.data;

    const { data: doc, error: docErr } = await db
      .from("sales_docs")
      .select("*")
      .eq("id", docId)
      .is("deleted_at", null)
      .maybeSingle();

    if (docErr) return apiError("فشل في قراءة الوثيقة", 500);
    if (!doc) return apiError("Not found", 404);

    // Allowed states to cancel from
    const cancellableStates = ["synced_to_commissions", "verified", "submitted"];
    if (!cancellableStates.includes(doc.status)) {
      return apiError(
        `لا يمكن إلغاء وثيقة بحالة '${doc.status}'. الحالات المسموحة: ${cancellableStates.join(", ")}`,
        400,
      );
    }

    const actorAppUserId =
      (auth as { appUserId?: string }).appUserId || auth.id;
    const now = new Date().toISOString();

    // Atomic cancel — only succeeds if still in a cancellable state
    const { data: cancelled, error: cancelErr } = await db
      .from("sales_docs")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: actorAppUserId,
        cancellation_reason: reason,
        updated_at: now,
      })
      .eq("id", docId)
      .in("status", cancellableStates)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (cancelErr) {
      // DB trigger may reject if month is locked
      if (cancelErr.message?.includes("locked")) {
        return apiError("لا يمكن الإلغاء — الشهر مقفل", 423);
      }
      console.error("[admin/sales-docs/cancel] update failed:", cancelErr);
      return apiError("فشل في إلغاء الوثيقة", 500);
    }
    if (!cancelled) {
      return apiError("تم إلغاؤها مسبقاً من مستخدم آخر", 409);
    }

    // Cancel linked commission rows
    let cancelledCommissionIds: number[] = [];
    let affectedMonths: string[] = [];
    try {
      const result = await cancelCommissionsByDoc(db, docId);
      cancelledCommissionIds = result.cancelledIds;
      affectedMonths = result.affectedMonths;
    } catch (cancelCommErr) {
      // Roll the doc back if commission cancellation fails
      if ((cancelCommErr as Error).message?.includes("locked")) {
        await db
          .from("sales_docs")
          .update({
            status: doc.status,
            cancelled_at: null,
            cancelled_by: null,
            cancellation_reason: null,
          })
          .eq("id", docId);
        return apiError("لا يمكن الإلغاء — الشهر مقفل", 423);
      }
      throw cancelCommErr;
    }

    await db.from("sales_doc_events").insert({
      sales_doc_id: docId,
      event_type: "cancelled",
      actor_user_id: actorAppUserId,
      actor_role: auth.role,
      payload: {
        reason,
        cancelled_commission_ids: cancelledCommissionIds,
        affected_months: affectedMonths,
      },
    });

    await logAudit(db, {
      userId: actorAppUserId,
      userName: auth.name || "Admin",
      userRole: auth.role,
      action: "cancel",
      module: "sales_docs",
      entityType: "sales_doc",
      entityId: String(docId),
      details: {
        reason,
        cancelled_commissions: cancelledCommissionIds,
        affected_months: affectedMonths,
      },
    });

    return apiSuccess({
      doc: cancelled,
      cancelled_commission_ids: cancelledCommissionIds,
      affected_months: affectedMonths,
    });
  } catch (err: unknown) {
    return safeError(err, "Admin Sales Docs Cancel", "خطأ في السيرفر", 500);
  }
}
