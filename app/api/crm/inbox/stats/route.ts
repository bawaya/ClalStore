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
      .select("status, unread_count, resolved_at");

    const convs = allConvs || [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const stats = {
      total_conversations: convs.length,
      active: convs.filter((c: any) => c.status === "active").length,
      waiting: convs.filter((c: any) => c.status === "waiting").length,
      bot: convs.filter((c: any) => c.status === "bot").length,
      resolved_today: convs.filter(
        (c: any) => c.status === "resolved" && c.resolved_at && new Date(c.resolved_at) >= todayStart
      ).length,
      messages_today: 0,
      unread_total: convs.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0),
    };

    // Messages today count
    const { count: msgCount } = await supabase
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    stats.messages_today = msgCount || 0;

    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
