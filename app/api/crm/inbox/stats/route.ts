export const runtime = "edge";

// =====================================================
// ClalMobile — Inbox Stats
// GET /api/crm/inbox/stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    // Count by status
    const { data: allConvs } = await supabase
      .from("inbox_conversations")
      .select("status, unread_count, resolved_at, first_response_at, created_at");

    const convs = allConvs || [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const resolved = convs.filter((c: any) => c.status === "resolved");
    const total = convs.length;

    const stats: Record<string, any> = {
      total_conversations: total,
      active: convs.filter((c: any) => c.status === "active").length,
      waiting: convs.filter((c: any) => c.status === "waiting").length,
      bot: convs.filter((c: any) => c.status === "bot").length,
      resolved_today: convs.filter(
        (c: any) => c.status === "resolved" && c.resolved_at && new Date(c.resolved_at) >= todayStart
      ).length,
      messages_today: 0,
      unread_total: convs.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0),
      resolution_rate: total > 0 ? Math.round((resolved.length / total) * 100) : 0,
      avg_response_time: null as number | null,
    };

    // Avg response time: first_response_at - created_at (minutes)
    const withResponse = convs.filter((c: any) => c.first_response_at && c.created_at);
    if (withResponse.length > 0) {
      const totalMs = withResponse.reduce((s: number, c: any) => {
        return s + (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime());
      }, 0);
      stats.avg_response_time = Math.round(totalMs / withResponse.length / 60000);
    }

    // Messages today count
    const { count: msgCount } = await supabase
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    stats.messages_today = msgCount || 0;

    // Pending/needs follow-up: last_message_direction=inbound, last_message_at > 24h ago
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: pendingCount } = await supabase
      .from("inbox_conversations")
      .select("id", { count: "exact", head: true })
      .eq("last_message_direction", "inbound")
      .lt("last_message_at", cutoff)
      .neq("status", "resolved");
    stats.pending_followup = pendingCount || 0;

    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
