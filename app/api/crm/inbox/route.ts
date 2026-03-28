export const runtime = 'edge';

// =====================================================
// ClalMobile — Inbox Conversations API
// GET /api/crm/inbox — list with filters, search, stats
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
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

    // Build query
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
      query = query.or(
        `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,last_message_text.ilike.%${search}%`
      );
    }
    if (sentiment) {
      query = query.eq("sentiment", sentiment);
    }

    const { data: conversations, count, error } = await query;
    if (error) {
      console.error("Inbox list error:", error);
      return apiError(error.message, 500);
    }

    // If label filter, get conversation IDs from junction table
    let filteredConvs = conversations || [];
    if (label) {
      const { data: labelConvs } = await supabase
        .from("inbox_conversation_labels")
        .select("conversation_id")
        .eq("label_id", label);
      const labelConvIds = new Set((labelConvs || []).map((l: any) => l.conversation_id));
      filteredConvs = filteredConvs.filter((c: any) => labelConvIds.has(c.id));
    }

    // Get labels for all conversations
    const convIds = filteredConvs.map((c: any) => c.id);
    let labelsMap: Record<string, any[]> = {};
    if (convIds.length > 0) {
      const { data: convLabels } = await supabase
        .from("inbox_conversation_labels")
        .select("conversation_id, label_id")
        .in("conversation_id", convIds);
      const labelIds = [...new Set((convLabels || []).map((cl: any) => cl.label_id))];
      if (labelIds.length > 0) {
        const { data: labels } = await supabase
          .from("inbox_labels")
          .select("*")
          .in("id", labelIds);
        const labelMap: Record<string, any> = {};
        (labels || []).forEach((l: any) => { labelMap[l.id] = l; });
        (convLabels || []).forEach((cl: any) => {
          if (!labelsMap[cl.conversation_id]) labelsMap[cl.conversation_id] = [];
          if (labelMap[cl.label_id]) labelsMap[cl.conversation_id].push(labelMap[cl.label_id]);
        });
      }
    }

    // Get assigned user names
    const assignedIds = [...new Set(filteredConvs.map((c: any) => c.assigned_to).filter(Boolean))];
    let usersMap: Record<string, { id: string; name: string }> = {};
    if (assignedIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", assignedIds);
      (users || []).forEach((u: any) => {
        usersMap[u.id] = { id: u.id, name: u.full_name || u.email || "موظف" };
      });
    }

    // Enrich with labels + assigned_user
    const enriched = filteredConvs.map((c: any) => ({
      ...c,
      labels: labelsMap[c.id] || [],
      assigned_user: c.assigned_to ? usersMap[c.assigned_to] || null : null,
    }));

    // Stats — use count queries instead of loading all conversations
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
      unread_total: (unreadRes.data || []).reduce((sum: number, c: { unread_count: number }) => sum + (c.unread_count || 0), 0),
    };

    return apiSuccess({ conversations: enriched, total: count || 0, stats });
  } catch (err: unknown) {
    console.error("Inbox error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
