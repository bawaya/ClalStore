
// =====================================================
// ClalMobile — Inbox Stats
// GET /api/crm/inbox/stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    // Use efficient COUNT queries instead of loading all rows
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [totalRes, activeRes, waitingRes, botRes, resolvedTodayRes, unreadRes, msgCountRes] = await Promise.all([
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "waiting"),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "bot"),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "resolved").gte("resolved_at", todayISO),
      supabase.from("inbox_conversations").select("unread_count").gt("unread_count", 0),
      supabase.from("inbox_messages").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    ]);

    const stats = {
      total_conversations: totalRes.count || 0,
      active: activeRes.count || 0,
      waiting: waitingRes.count || 0,
      bot: botRes.count || 0,
      resolved_today: resolvedTodayRes.count || 0,
      messages_today: msgCountRes.count || 0,
      unread_total: (unreadRes.data || []).reduce((sum: number, c: { unread_count: number }) => sum + (c.unread_count || 0), 0),
    };

    return apiSuccess({ stats });
  } catch {
    return apiError("خطأ في السيرفر", 500);
  }
}
