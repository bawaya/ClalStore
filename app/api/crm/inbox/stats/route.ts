
// =====================================================
// ClalMobile — Inbox Stats
// GET /api/crm/inbox/stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

interface ConversationStats {
  status: string;
  unread_count: number;
  resolved_at: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    // Count by status
    const { data: allConvs } = await supabase
      .from("inbox_conversations")
      .select("status, unread_count, resolved_at");

    const convs = allConvs || [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const stats = {
      total_conversations: convs.length,
      active: convs.filter((c: ConversationStats) => c.status === "active").length,
      waiting: convs.filter((c: ConversationStats) => c.status === "waiting").length,
      bot: convs.filter((c: ConversationStats) => c.status === "bot").length,
      resolved_today: convs.filter(
        (c: ConversationStats) => c.status === "resolved" && c.resolved_at && new Date(c.resolved_at) >= todayStart
      ).length,
      messages_today: 0,
      unread_total: convs.reduce((sum: number, c: ConversationStats) => sum + (c.unread_count || 0), 0),
    };

    // Messages today count
    const { count: msgCount } = await supabase
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    stats.messages_today = msgCount || 0;

    return apiSuccess({ stats });
  } catch {
    return apiError("خطأ في السيرفر", 500);
  }
}
