// =====================================================
// ClalMobile — Inbox Conversations API
// GET /api/crm/inbox — list with filters, search, stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const assigned = searchParams.get("assigned");
    const label = searchParams.get("label");
    const sentiment = searchParams.get("sentiment");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("inbox_conversations")
      .select("*", { count: "exact" })
      .order("pinned", { ascending: false })
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (assigned) {
      query = query.eq("assigned_to", assigned);
    }
    if (search) {
      const cleanSearch = search.replace(/[%_\\]/g, "").slice(0, 100);
      if (cleanSearch) {
        query = query.or(
          `customer_name.ilike.%${cleanSearch}%,customer_phone.ilike.%${cleanSearch}%,last_message_text.ilike.%${cleanSearch}%`,
        );
      }
    }
    if (sentiment) {
      query = query.eq("sentiment", sentiment);
    }

    const { data: conversations, count, error } = await query;
    if (error) {
      console.error("Inbox list error:", error);
      return apiError("فشل في جلب المحادثات", 500);
    }

    let filteredConvs = conversations || [];
    if (label) {
      const { data: labelConvs } = await supabase
        .from("inbox_conversation_labels")
        .select("conversation_id")
        .eq("label_id", label);

      const labelConvIds = (labelConvs || []).map((row: any) => row.conversation_id);
      if (labelConvIds.length === 0) {
        return apiSuccess({
          conversations: [],
          total: 0,
          stats: {
            total_conversations: 0,
            active: 0,
            waiting: 0,
            bot: 0,
            resolved_today: 0,
            messages_today: 0,
            unread_total: 0,
          },
        });
      }

      filteredConvs = filteredConvs.filter((conv: any) => labelConvIds.includes(conv.id));
    }

    const convIds = filteredConvs.map((conv: any) => conv.id);
    const labelsMap: Record<string, any[]> = {};
    if (convIds.length > 0) {
      const { data: convLabels } = await supabase
        .from("inbox_conversation_labels")
        .select("conversation_id, label_id")
        .in("conversation_id", convIds);

      const labelIds = [...new Set((convLabels || []).map((row: any) => row.label_id))];
      if (labelIds.length > 0) {
        const { data: labels } = await supabase
          .from("inbox_labels")
          .select("*")
          .in("id", labelIds);

        const labelMap: Record<string, any> = {};
        (labels || []).forEach((labelRow: any) => {
          labelMap[labelRow.id] = labelRow;
        });

        (convLabels || []).forEach((row: any) => {
          if (!labelsMap[row.conversation_id]) labelsMap[row.conversation_id] = [];
          if (labelMap[row.label_id]) labelsMap[row.conversation_id].push(labelMap[row.label_id]);
        });
      }
    }

    const assignedIds = [...new Set(filteredConvs.map((conv: any) => conv.assigned_to).filter(Boolean))];
    const usersMap: Record<string, { id: string; name: string }> = {};
    if (assignedIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", assignedIds);

      (users || []).forEach((userRow: any) => {
        usersMap[userRow.id] = { id: userRow.id, name: userRow.name || userRow.email || "موظف" };
      });
    }

    const enriched = filteredConvs.map((conv: any) => ({
      ...conv,
      labels: labelsMap[conv.id] || [],
      assigned_user: conv.assigned_to ? usersMap[conv.assigned_to] || null : null,
    }));

    const [totalRes, activeRes, waitingRes, botRes, unreadRes] = await Promise.all([
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "waiting"),
      supabase.from("inbox_conversations").select("id", { count: "exact", head: true }).eq("status", "bot"),
      supabase.from("inbox_conversations").select("unread_count").gt("unread_count", 0),
    ]);

    const stats = {
      total_conversations: totalRes.count || 0,
      active: activeRes.count || 0,
      waiting: waitingRes.count || 0,
      bot: botRes.count || 0,
      resolved_today: 0,
      messages_today: 0,
      unread_total: (unreadRes.data || []).reduce(
        (sum: number, conv: { unread_count: number }) => sum + (conv.unread_count || 0),
        0,
      ),
    };

    return apiSuccess({ conversations: enriched, total: count || 0, stats });
  } catch (err: unknown) {
    console.error("Inbox error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
