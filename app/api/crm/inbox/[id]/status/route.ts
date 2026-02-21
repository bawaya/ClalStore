export const runtime = "edge";

// =====================================================
// ClalMobile — Change Conversation Status
// PUT /api/crm/inbox/[id]/status
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { status } = await req.json();
    const convId = params.id;

    const validStatuses = ["active", "waiting", "bot", "resolved", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "حالة غير صالحة" }, { status: 400 });
    }

    // Get current status
    const { data: conv } = await supabase
      .from("inbox_conversations")
      .select("status")
      .eq("id", convId)
      .single();

    const oldStatus = (conv as any)?.status || "active";

    const updates: Record<string, any> = { status };
    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }

    await supabase
      .from("inbox_conversations")
      .update(updates)
      .eq("id", convId);

    // Log event
    await supabase.from("inbox_events").insert({
      conversation_id: convId,
      event_type: "status_changed",
      old_value: oldStatus,
      new_value: status,
    } as any);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Status error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
