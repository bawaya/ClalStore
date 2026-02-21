export const runtime = "edge";

// =====================================================
// ClalMobile — Assign Agent to Conversation
// PUT /api/crm/inbox/[id]/assign
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { user_id } = await req.json();
    const convId = params.id;

    // Get agent name
    let agentName = "موظف";
    if (user_id) {
      const { data: user } = await supabase.from("users").select("name").eq("id", user_id).single();
      if (user) agentName = (user as any).name;
    }

    // Update conversation
    await supabase
      .from("inbox_conversations")
      .update({
        assigned_to: user_id || null,
        assigned_at: user_id ? new Date().toISOString() : null,
      } as any)
      .eq("id", convId);

    // Log event
    await supabase.from("inbox_events").insert({
      conversation_id: convId,
      event_type: "assigned",
      actor_name: agentName,
      new_value: agentName,
    } as any);

    // Add system message
    await supabase.from("inbox_messages").insert({
      conversation_id: convId,
      direction: "outbound",
      sender_type: "system",
      message_type: "text",
      content: `تم تعيين ${agentName} لهذه المحادثة`,
      status: "sent",
    } as any);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Assign error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
