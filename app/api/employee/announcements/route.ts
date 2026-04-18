/**
 * GET /api/employee/announcements
 *
 * Returns the authed employee's unread announcements first, then recent read ones.
 * Also returns an unread count for the navbar badge.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const now = new Date().toISOString();

    const { data: announcements, error: annErr } = await db
      .from("admin_announcements")
      .select("id, title, body, priority, target, created_by, expires_at, created_at")
      .or(`target.eq.all,target.eq.employees`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (annErr) return safeError(annErr, "announcements/list");

    const rows = (announcements || []) as Array<{ id: number } & Record<string, unknown>>;
    const ids = rows.map((a) => a.id);
    const readSet = new Set<number>();
    if (ids.length > 0) {
      const { data: reads } = await db
        .from("admin_announcement_reads")
        .select("announcement_id")
        .eq("user_id", authed.appUserId)
        .in("announcement_id", ids);
      const readRows = (reads || []) as Array<{ announcement_id: number }>;
      for (const r of readRows) readSet.add(r.announcement_id);
    }

    const annotated = rows.map((a) => ({
      ...a,
      read: readSet.has(a.id),
    }));

    const unreadCount = annotated.filter((a: { read: boolean }) => !a.read).length;

    return apiSuccess({
      announcements: annotated,
      unreadCount,
    });
  } catch (err) {
    return safeError(err, "EmployeeAnnouncements", "خطأ في السيرفر", 500);
  }
}
