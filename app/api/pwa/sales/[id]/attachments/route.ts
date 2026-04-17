import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import { validateBody } from "@/lib/admin/validators";
import { z } from "zod";

const attachmentSchema = z.object({
  attachment_type: z.string().min(1).max(50),
  file_path: z.string().min(1).max(1000),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(100),
  file_size: z.number().int().min(1),
  sha256: z.string().max(100).optional().nullable(),
});

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
      .select("id, employee_key, status")
      .eq("id", docId)
      .is("deleted_at", null)
      .single();

    if (!doc) return apiError("Not found", 404);
    if (doc.employee_key !== authed.appUserId) return apiError("Forbidden", 403);
    if (!["draft", "rejected"].includes(doc.status)) return apiError("لا يمكن إضافة مرفقات لهذه الحالة", 400);

    const body = await req.json();
    const validation = validateBody(body, attachmentSchema);
    if (validation.error) return apiError(validation.error, 400);
    if (!validation.data) return apiError("Invalid payload", 400);

    const payload = validation.data;
    const now = new Date().toISOString();

    const { data: inserted, error } = await db
      .from("sales_doc_attachments")
      .insert({
        sales_doc_id: docId,
        attachment_type: payload.attachment_type,
        file_path: payload.file_path,
        file_name: payload.file_name,
        mime_type: payload.mime_type,
        file_size: payload.file_size,
        sha256: payload.sha256 || null,
        uploaded_by: authed.appUserId,
        created_at: now,
      })
      .select("*")
      .single();

    if (error || !inserted) return apiError("فشل في حفظ المرفق", 500);

    await db.from("sales_doc_events").insert({
      sales_doc_id: docId,
      event_type: "attachment_added",
      actor_user_id: authed.appUserId,
      actor_role: authed.role,
      payload: { attachment_type: inserted.attachment_type, file_name: inserted.file_name },
    });

    return apiSuccess(inserted, undefined, 201);
  } catch (err: unknown) {
    return safeError(err, "PWA Attachments POST", "خطأ في السيرفر", 500);
  }
}
