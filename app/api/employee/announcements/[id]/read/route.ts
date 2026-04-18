/**
 * POST /api/employee/announcements/[id]/read
 *
 * Mark an announcement as read by the authed user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await ctx.params;
    const annId = Number(id);
    if (!annId || Number.isNaN(annId)) return apiError("Invalid id", 400);

    const { error } = await db
      .from("admin_announcement_reads")
      .upsert(
        {
          announcement_id: annId,
          user_id: authed.appUserId,
        },
        { onConflict: "announcement_id,user_id" },
      );

    if (error) return safeError(error, "announcements/mark-read");
    return apiSuccess({ ok: true });
  } catch (err) {
    return safeError(err, "AnnouncementRead", "خطأ في السيرفر", 500);
  }
}
