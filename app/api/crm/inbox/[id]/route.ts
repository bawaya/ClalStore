export const runtime = "edge";

// =====================================================
// ClalMobile — Single Conversation + Messages
// GET /api/crm/inbox/[id] — conversation detail + messages
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const convId = params.id;
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Fetch conversation
    const { data: conversation, error: convErr } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", convId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ success: false, error: "المحادثة غير موجودة" }, { status: 404 });
    }

    // Fetch messages with cursor pagination
    let msgQuery = supabase
      .from("inbox_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (before) {
      msgQuery = msgQuery.lt("created_at", before);
    }

    const { data: messages } = await msgQuery;

    // Check if there are more messages
    let has_more = false;
    if (messages && messages.length > 0) {
      const { count } = await supabase
        .from("inbox_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .lt("created_at", messages[0].created_at);
      has_more = (count || 0) > 0;
    }

    // Fetch customer from customers table
    let customer = null;
    if (conversation.customer_phone) {
      const phone = (conversation.customer_phone as string).replace(/[-\s+]/g, "");
      const phoneVariants = [phone];
      if (phone.startsWith("972")) phoneVariants.push("0" + phone.slice(3));
      if (phone.startsWith("0")) phoneVariants.push("972" + phone.slice(1));

      for (const pv of phoneVariants) {
        const { data: cust } = await supabase
          .from("customers")
          .select("id, name, phone, email, city, address, total_orders, total_spent, segment, tags, created_at")
          .eq("phone", pv)
          .single();
        if (cust) { customer = cust; break; }
      }
    }

    // Fetch labels
    const { data: convLabels } = await supabase
      .from("inbox_conversation_labels")
      .select("label_id")
      .eq("conversation_id", convId);
    const labelIds = (convLabels || []).map((cl: any) => cl.label_id);
    let labels: any[] = [];
    if (labelIds.length > 0) {
      const { data: lbls } = await supabase.from("inbox_labels").select("*").in("id", labelIds);
      labels = lbls || [];
    }

    // Fetch notes
    const { data: notes } = await supabase
      .from("inbox_notes")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    // Reset unread count
    if ((conversation as any).unread_count > 0) {
      await supabase
        .from("inbox_conversations")
        .update({ unread_count: 0 })
        .eq("id", convId);
    }

    return NextResponse.json({
      success: true,
      conversation,
      messages: messages || [],
      customer,
      labels,
      notes: notes || [],
      has_more,
    });
  } catch (err: any) {
    console.error("Inbox detail error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
