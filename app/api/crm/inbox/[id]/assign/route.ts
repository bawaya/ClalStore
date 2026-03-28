export const runtime = 'edge';

// =====================================================
// ClalMobile — Assign Agent to Conversation
// PUT /api/crm/inbox/[id]/assign
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { user_id } = await req.json();
    const convId = id;

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

    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Assign error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
