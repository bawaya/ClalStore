
// =====================================================
// ClalMobile — Conversation Notes
// GET/POST /api/crm/inbox/[id]/notes
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { data: notes } = await supabase
      .from("inbox_notes")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    return apiSuccess({ notes: notes || [] });
  } catch {
    return apiError("خطأ في السيرفر", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { content, author_name } = await req.json();
    if (!content?.trim()) {
      return apiError("المحتوى مطلوب", 400);
    }

    const { data: note, error } = await supabase
      .from("inbox_notes")
      .insert({
        conversation_id: id,
        author_name: author_name || "موظف",
        content: content.trim(),
      } as any)
      .select("*")
      .single();

    if (error) {
      console.error("Notes POST error:", error);
      return apiError("فشل في حفظ الملاحظة", 500);
    }

    // Also save as note-type message so it appears in chat
    await supabase.from("inbox_messages").insert({
      conversation_id: id,
      direction: "outbound",
      sender_type: "agent",
      sender_name: author_name || "موظف",
      message_type: "note",
      content: content.trim(),
      status: "sent",
    } as any);

    return apiSuccess({ note });
  } catch {
    return apiError("خطأ في السيرفر", 500);
  }
}
