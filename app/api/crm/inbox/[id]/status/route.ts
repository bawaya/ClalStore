export const runtime = 'nodejs';

// =====================================================
// ClalMobile — Change Conversation Status
// PUT /api/crm/inbox/[id]/status
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { status } = await req.json();
    const convId = params.id;

    const validStatuses = ["active", "waiting", "bot", "resolved", "archived"];
    if (!validStatuses.includes(status)) {
      return apiError("حالة غير صالحة", 400);
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

    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Status error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
