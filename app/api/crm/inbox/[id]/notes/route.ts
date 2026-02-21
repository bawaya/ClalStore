export const runtime = "edge";

// =====================================================
// ClalMobile — Conversation Notes
// GET/POST /api/crm/inbox/[id]/notes
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { data: notes } = await supabase
      .from("inbox_notes")
      .select("*")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { content, author_name } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: "المحتوى مطلوب" }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from("inbox_notes")
      .insert({
        conversation_id: params.id,
        author_name: author_name || "موظف",
        content: content.trim(),
      } as any)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also save as note-type message so it appears in chat
    await supabase.from("inbox_messages").insert({
      conversation_id: params.id,
      direction: "outbound",
      sender_type: "agent",
      sender_name: author_name || "موظف",
      message_type: "note",
      content: content.trim(),
      status: "sent",
    } as any);

    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
