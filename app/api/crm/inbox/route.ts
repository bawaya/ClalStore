export const runtime = "edge";

// =====================================================
// ClalMobile — Inbox Conversations API
// GET /api/crm/inbox — list with filters, search, stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

    // Enrich with labels
    const enriched = filteredConvs.map((c: any) => ({
      ...c,
      labels: labelsMap[c.id] || [],
    }));

    // Stats
    const { data: allConvs } = await supabase
      .from("inbox_conversations")
      .select("status, unread_count");
    const stats = {
      total_conversations: (allConvs || []).length,
      active: (allConvs || []).filter((c: any) => c.status === "active").length,
      waiting: (allConvs || []).filter((c: any) => c.status === "waiting").length,
      bot: (allConvs || []).filter((c: any) => c.status === "bot").length,
      resolved_today: 0,
      messages_today: 0,
      unread_total: (allConvs || []).reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0),
    };

    return NextResponse.json({
      success: true,
      conversations: enriched,
      total: count || 0,
      stats,
    });
  } catch (err: any) {
    console.error("Inbox error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
