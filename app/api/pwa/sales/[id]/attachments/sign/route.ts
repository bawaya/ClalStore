/**
 * POST /api/pwa/sales/[id]/attachments/sign
 *
 * Returns a Supabase Storage Signed Upload URL so the PWA client can upload
 * the file directly. This is the first half of the real-upload flow:
 *
 *   1. Client -> POST /.../sign       (returns signed upload URL + path)
 *   2. Client -> PUT to the signed URL with the file bytes
 *   3. Client -> POST /.../attachments (records metadata after successful upload)
 *
 * Fixes audit issue 4.3 (fake file paths accepted as attachments).
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import { validateBody } from "@/lib/admin/validators";
import { attachmentSignRequestSchema } from "@/lib/pwa/validators";
import { randomUUID } from "crypto";

const BUCKET = "sales-docs-private";

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
    if (!["draft", "rejected"].includes(doc.status)) {
      return apiError("لا يمكن إضافة مرفقات لهذه الحالة", 400);
    }

    const body = await req.json();
    const validation = validateBody(body, attachmentSignRequestSchema);
    if (validation.error || !validation.data) {
      return apiError(validation.error || "Invalid payload", 400);
    }

    const { attachment_type, file_name, mime_type, file_size } = validation.data;

    // Stable, server-controlled path. Employee can't forge this.
    const ext = (file_name.match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
    const stableFileName = `${randomUUID()}${ext}`;
    const storagePath = `sales-docs/${docId}/${attachment_type}/${stableFileName}`;

    // Create signed upload URL (short-lived; client has 5 minutes to PUT)
    // Note: Supabase JS SDK's createSignedUploadUrl is the standard API.
    const { data: signed, error: signErr } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signErr || !signed) {
      console.error("[attachments/sign] storage sign failed:", signErr);
      return apiError("فشل في تجهيز رفع الملف", 500);
    }

    return apiSuccess({
      storage_path: storagePath,
      signed_url: signed.signedUrl,
      token: signed.token,
      bucket: BUCKET,
      expected: {
        attachment_type,
        mime_type,
        file_size,
        file_name: stableFileName,
        original_name: file_name,
      },
    });
  } catch (err: unknown) {
    return safeError(err, "PWA Attachments Sign", "خطأ في السيرفر", 500);
  }
}
