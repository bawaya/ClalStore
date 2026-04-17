import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";

function requiredAttachmentsForSaleType(saleType: string): string[] {
  if (saleType === "line") return ["contract_photo", "signed_form"];
  if (saleType === "device") return ["invoice", "device_serial_proof"];
  if (saleType === "mixed") return ["contract_photo", "signed_form", "invoice", "device_serial_proof"];
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

    const { data: doc } = await db
      .from("sales_docs")
      .select("*")
      .eq("id", docId)
      .is("deleted_at", null)
      .single();

    if (!doc) return apiError("Not found", 404);
    if (doc.employee_key !== authed.appUserId) return apiError("Forbidden", 403);
    if (!["draft", "rejected"].includes(doc.status)) return apiError("لا يمكن إرسال هذه الحالة", 400);

    const required = requiredAttachmentsForSaleType(doc.sale_type);
    const { data: attachments } = await db
      .from("sales_doc_attachments")
      .select("attachment_type")
      .eq("sales_doc_id", docId)
      .is("deleted_at", null);

    const existingTypes = new Set((attachments || []).map((a: any) => a.attachment_type));
    const missing = required.filter((type) => !existingTypes.has(type));

    if (missing.length > 0) {
      return apiError(`مرفقات ناقصة: ${missing.join(", ")}`, 400);
    }

    const now = new Date().toISOString();

    const { data: updated, error } = await db
      .from("sales_docs")
      .update({
        status: "submitted",
        submitted_at: now,
        rejection_reason: null,
        rejected_at: null,
        updated_at: now,
      })
      .eq("id", docId)
      .select("*")
      .single();

    if (error || !updated) return apiError("فشل في إرسال العملية", 500);

    await db.from("sales_doc_events").insert({
      sales_doc_id: updated.id,
      event_type: "submitted",
      actor_user_id: authed.appUserId,
      actor_role: authed.role,
      payload: { status: updated.status },
    });

    return apiSuccess(updated);
  } catch (err: unknown) {
    return safeError(err, "PWA Sales Submit", "خطأ في السيرفر", 500);
  }
}

