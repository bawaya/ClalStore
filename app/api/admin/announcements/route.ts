/**
 * GET  /api/admin/announcements — list all, with read counts
 * POST /api/admin/announcements — publish a new announcement
 */

import { NextRequest } from "next/server";
import { requireAdmin, hasPermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { actorId } from "@/lib/admin/actor";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  target: z.enum(["all", "employees", "admins"]).default("all"),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ("status" in auth) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { data: announcements, error } = await db
      .from("admin_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return safeError(error, "admin/announcements/list");

    const list = (announcements || []) as Array<{ id: number }>;
    const ids = list.map((a) => a.id);
    const readCounts = new Map<number, number>();
    if (ids.length > 0) {
      const { data: reads } = await db
        .from("admin_announcement_reads")
        .select("announcement_id")
        .in("announcement_id", ids);
      const readRows = (reads || []) as Array<{ announcement_id: number }>;
      for (const r of readRows) {
        const cur = readCounts.get(r.announcement_id) || 0;
        readCounts.set(r.announcement_id, cur + 1);
      }
    }

    // How many users could have read it (active employees)
    const { count: activeUsers } = await db
      .from("users")
      .select("id", { count: "exact", head: true })
      .neq("role", "customer")
      .neq("status", "inactive")
      .neq("status", "suspended");

    return apiSuccess({
      announcements: (announcements || []).map((a: { id: number }) => ({
        ...a,
        readCount: readCounts.get(a.id) || 0,
        totalRecipients: activeUsers || 0,
      })),
    });
  } catch (err) {
    return safeError(err, "AdminAnnouncements/GET", "خطأ في السيرفر", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ("status" in auth) return auth;

    if (!hasPermission(auth.role, "settings", "manage")) {
      return apiError("ليس لديك صلاحية لنشر الرسائل", 403);
    }

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const { data, error } = await db
      .from("admin_announcements")
      .insert({
        title: parsed.data.title,
        body: parsed.data.body,
        priority: parsed.data.priority,
        target: parsed.data.target,
        created_by: actorId(auth as { appUserId?: string }),
        expires_at: parsed.data.expiresAt || null,
      })
      .select()
      .single();

    if (error || !data) return safeError(error, "admin/announcements/insert");

    return apiSuccess({ announcement: data }, undefined, 201);
  } catch (err) {
    return safeError(err, "AdminAnnouncements/POST", "خطأ في السيرفر", 500);
  }
}
