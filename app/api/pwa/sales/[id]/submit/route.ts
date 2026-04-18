/**
 * POST /api/pwa/sales/[id]/submit
 *
 * Direct commission registration (decision 1 — no manager approval):
 *   - Validates doc has required attachments (now real files, see audit 4.3)
 *   - Atomically transitions status from draft|rejected → synced_to_commissions
 *     (atomic UPDATE WHERE status IN (...) prevents double-submit, audit 4.2)
 *   - Calls registerSaleCommission so the sale enters commission_sales
 *     immediately. Manager can cancel later via /api/admin/sales-docs/[id]/cancel.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import { registerSaleCommission } from "@/lib/commissions/register";

function requiredAttachmentsForSaleType(saleType: string): string[] {
  if (saleType === "line") return ["contract_photo", "signed_form"];
  if (saleType === "device") return ["invoice", "device_serial_proof"];
  if (saleType === "mixed") {
    return ["contract_photo", "signed_form", "invoice", "device_serial_proof"];
  }
  return [];
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await ctx.params;
    const docId = Number(id);
    if (!docId || Number.isNaN(docId)) return apiError("Invalid id", 400);

    const { data: doc, error: docErr } = await db
      .from("sales_docs")
      .select("*")
      .eq("id", docId)
      .is("deleted_at", null)
      .maybeSingle();

    if (docErr) return apiError("فشل في قراءة الوثيقة", 500);
    if (!doc) return apiError("Not found", 404);
    if (doc.employee_key !== authed.appUserId) return apiError("Forbidden", 403);

    if (!["draft", "rejected"].includes(doc.status)) {
      return apiError("هذه الوثيقة تم إرسالها مسبقاً", 409);
    }

    // Validate total_amount one more time on submit — new sanity cap
    const amount = Number(doc.total_amount || 0);
    if (!(amount > 0)) {
      return apiError("مبلغ البيع يجب أن يكون أكبر من صفر", 400);
    }

    // Validate required attachments exist
    const required = requiredAttachmentsForSaleType(doc.sale_type);
    if (required.length > 0) {
      const { data: attachments } = await db
        .from("sales_doc_attachments")
        .select("attachment_type")
        .eq("sales_doc_id", docId)
        .is("deleted_at", null);

      const existingTypes = new Set(
        (attachments || []).map((a: { attachment_type: string }) => a.attachment_type),
      );
      const missing = required.filter((t) => !existingTypes.has(t));

      if (missing.length > 0) {
        return apiError(`مرفقات ناقصة: ${missing.join(", ")}`, 400);
      }
    }

    const now = new Date().toISOString();

    // Atomic transition: only succeeds if status is still draft or rejected.
    // Second concurrent submit returns 0 rows (fixes audit 4.2).
    const { data: updated, error: updErr } = await db
      .from("sales_docs")
      .update({
        status: "synced_to_commissions",
        submitted_at: doc.submitted_at || now,
        synced_at: now,
        rejection_reason: null,
        rejected_at: null,
        updated_at: now,
      })
      .eq("id", docId)
      .in("status", ["draft", "rejected"])
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (updErr) {
      console.error("[pwa/submit] update failed:", updErr);
      return apiError("فشل في إرسال العملية", 500);
    }
    if (!updated) {
      return apiError("الوثيقة تم إرسالها مسبقاً من مستخدم آخر", 409);
    }

    // Register the commission. For 'mixed' docs we register both line and device.
    try {
      const registrations: Array<{ saleType: "line" | "device"; amount: number }> = [];

      if (updated.sale_type === "line") {
        registrations.push({ saleType: "line", amount });
      } else if (updated.sale_type === "device") {
        registrations.push({ saleType: "device", amount });
      } else if (updated.sale_type === "mixed") {
        // Split: derive line vs device amounts from items if available; else halve.
        const { data: items } = await db
          .from("sales_doc_items")
          .select("item_type, line_total")
          .eq("sales_doc_id", docId)
          .is("deleted_at", null);

        let lineTotal = 0;
        let deviceTotal = 0;
        for (const item of items || []) {
          const t = Number(item.line_total || 0);
          if (item.item_type === "line") lineTotal += t;
          else if (item.item_type === "device") deviceTotal += t;
        }

        if (lineTotal + deviceTotal === 0) {
          lineTotal = amount / 2;
          deviceTotal = amount / 2;
        }

        if (lineTotal > 0) registrations.push({ saleType: "line", amount: lineTotal });
        if (deviceTotal > 0) registrations.push({ saleType: "device", amount: deviceTotal });
      }

      const results = [];
      for (const reg of registrations) {
        const r = await registerSaleCommission(db, {
          saleType: reg.saleType,
          amount: reg.amount,
          employeeId: updated.employee_key,
          saleDate:
            (updated.sale_date as string | null) ||
            now.slice(0, 10),
          source: "sales_doc",
          sourceSalesDocId: updated.id,
          customerId: updated.customer_id ?? null,
          customerPhone: updated.customer_phone ?? null,
          packagePrice: reg.saleType === "line" ? reg.amount : undefined,
          notes: `PWA doc ${updated.id}`,
        });
        results.push(r);
      }

      await db.from("sales_doc_events").insert({
        sales_doc_id: updated.id,
        event_type: "submitted_and_synced",
        actor_user_id: authed.appUserId,
        actor_role: authed.role,
        payload: {
          commission_ids: results.map((r) => r.id),
          total_employee_commission: results.reduce(
            (s, r) => s + r.employeeCommission,
            0,
          ),
        },
      });

      return apiSuccess({
        doc: updated,
        commissions: results,
      });
    } catch (commissionErr) {
      // Roll the doc back to "rejected" with a clear error — keeps system consistent
      await db
        .from("sales_docs")
        .update({
          status: "rejected",
          rejection_reason: `Commission registration failed: ${(commissionErr as Error).message}`,
          rejected_at: new Date().toISOString(),
          synced_at: null,
        })
        .eq("id", docId);

      await db.from("sales_doc_events").insert({
        sales_doc_id: docId,
        event_type: "submit_failed",
        actor_user_id: authed.appUserId,
        actor_role: authed.role,
        payload: { error: (commissionErr as Error).message },
      });

      return apiError(
        `فشل تسجيل العمولة: ${(commissionErr as Error).message}`,
        500,
      );
    }
  } catch (err: unknown) {
    return safeError(err, "PWA Sales Submit", "خطأ في السيرفر", 500);
  }
}
