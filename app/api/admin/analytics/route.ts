
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("DB error", 500);
    }

    const days = Number(req.nextUrl.searchParams.get("days") || "30");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const prevSince = new Date(Date.now() - 2 * days * 24 * 60 * 60 * 1000).toISOString();

    const [ordersRes, prevOrdersRes, botRes, prevBotRes, inboxRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total, status, source, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("id, total, status, source, created_at")
        .gte("created_at", prevSince)
        .lt("created_at", since)
        .order("created_at", { ascending: true }),
      supabase
        .from("bot_analytics")
        .select("date, total_conversations, total_messages, handoffs, avg_csat, store_clicks")
        .gte("date", since.split("T")[0])
        .order("date", { ascending: true }),
      supabase
        .from("bot_analytics")
        .select("date, total_conversations, total_messages, handoffs, avg_csat, store_clicks")
        .gte("date", prevSince.split("T")[0])
        .lt("date", since.split("T")[0])
        .order("date", { ascending: true }),
      supabase
        .from("inbox_conversations")
        .select("id, status, sentiment, created_at")
        .gte("created_at", since),
    ]);

    const orders = ordersRes.data || [];
    const prevOrders = prevOrdersRes.data || [];
    const botDays = botRes.data || [];
    const prevBotDays = prevBotRes.data || [];
    const inbox = inboxRes.data || [];

    const dailyRevenue: Record<string, { revenue: number; orders: number }> = {};
    const statusCount: Record<string, number> = {};
    const sourceCount: Record<string, number> = {};
    let totalRevenue = 0;

    for (const o of orders) {
      const day = new Date(o.created_at).toISOString().split("T")[0];
      if (!dailyRevenue[day]) dailyRevenue[day] = { revenue: 0, orders: 0 };
      dailyRevenue[day].revenue += Number(o.total) || 0;
      dailyRevenue[day].orders += 1;
      totalRevenue += Number(o.total) || 0;
      statusCount[o.status] = (statusCount[o.status] || 0) + 1;
      if (o.source) sourceCount[o.source] = (sourceCount[o.source] || 0) + 1;
    }

    const revenueChart = Object.entries(dailyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders }));

    let totalConversations = 0;
    let totalHandoffs = 0;
    let totalStoreClicks = 0;
    let csatSum = 0;
    let csatCount = 0;
    let prevConversations = 0;
    let prevHandoffs = 0;
    let _prevStoreClicks = 0;
    let _prevCsatSum = 0;
    let _prevCsatCount = 0;

    for (const d of botDays) {
      totalConversations += d.total_conversations || 0;
      totalHandoffs += d.handoffs || 0;
      totalStoreClicks += d.store_clicks || 0;
      if (d.avg_csat) { csatSum += d.avg_csat; csatCount++; }
    }
    for (const d of prevBotDays) {
      prevConversations += d.total_conversations || 0;
      prevHandoffs += d.handoffs || 0;
      _prevStoreClicks += d.store_clicks || 0;
      if (d.avg_csat) { _prevCsatSum += d.avg_csat; _prevCsatCount++; }
    }

    const prevRevenue = prevOrders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
    const prevOrderCount = prevOrders.length;

    const sentimentCount: Record<string, number> = {};
    const inboxStatusCount: Record<string, number> = {};
    for (const c of inbox) {
      if (c.sentiment) sentimentCount[c.sentiment] = (sentimentCount[c.sentiment] || 0) + 1;
      if (c.status) inboxStatusCount[c.status] = (inboxStatusCount[c.status] || 0) + 1;
    }

    const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    const ordersChange = prevOrderCount > 0 ? Math.round(((orders.length - prevOrderCount) / prevOrderCount) * 100) : 0;
    const convChange = prevConversations > 0 ? Math.round(((totalConversations - prevConversations) / prevConversations) * 100) : 0;
    const handoffChange = prevHandoffs > 0 ? Math.round(((totalHandoffs - prevHandoffs) / prevHandoffs) * 100) : 0;

    return apiSuccess({
        sales: {
          totalRevenue: Math.round(totalRevenue),
          totalOrders: orders.length,
          avgOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
          statusBreakdown: statusCount,
          sourceBreakdown: sourceCount,
          daily: revenueChart,
          prevRevenue: Math.round(prevRevenue),
          prevOrders: prevOrderCount,
          revenueChange,
          ordersChange,
        },
        bot: {
          totalConversations,
          totalHandoffs,
          totalStoreClicks,
          avgCsat: csatCount > 0 ? Math.round((csatSum / csatCount) * 10) / 10 : 0,
          daily: botDays,
          prevConversations,
          prevHandoffs,
          convChange,
          handoffChange,
        },
        inbox: {
          totalConversations: inbox.length,
          sentimentBreakdown: sentimentCount,
          statusBreakdown: inboxStatusCount,
        },
    });
  } catch (err: unknown) {
    console.error("Analytics API error:", err);
    return apiError("فشل في جلب التحليلات", 500);
  }
}
