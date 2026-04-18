import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { hasPermission, requireAdmin } from "@/lib/admin/auth";
import { actorId } from "@/lib/admin/actor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    if (!hasPermission((auth as any).role, "commissions", "manage")) {
      return apiError("ليس لديك صلاحية لهذا الإجراء", 403);
    }

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const docId = Number(id);
    if (!docId || Number.isNaN(docId)) return apiError("Invalid id", 400);

    const { data: existing } = await db
      .from("sales_docs")
      .select("id, status")
      .eq("id", docId)
      .is("deleted_at", null)
      .single();

    if (!existing) return apiError("Not found", 404);
    if (existing.status !== "submitted") return apiError("يجب أن تكون العملية مُرسلة أولاً", 400);

    const now = new Date().toISOString();
    const { data: updated, error } = await db
      .from("sales_docs")
      .update({
        status: "verified",
        verified_at: now,
        updated_at: now,
      })
      .eq("id", docId)
      .select("*")
      .single();

    if (error || !updated) return apiError("فشل في الاعتماد", 500);

    await db.from("sales_doc_events").insert({
      sales_doc_id: docId,
      event_type: "verified",
      actor_user_id: actorId(auth as { appUserId?: string }),
      actor_role: (auth as { role?: string }).role,
      payload: { status: "verified" },
    });

    return apiSuccess(updated);
  } catch (err: unknown) {
    return safeError(err, "Admin SalesDocs Verify", "خطأ في السيرفر", 500);
  }
}

