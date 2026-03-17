export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

// GET — all labels
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { data: labels } = await supabase
      .from("inbox_labels")
      .select("*")
      .order("sort_order", { ascending: true });

    return NextResponse.json({ success: true, labels: labels || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST — attach label to conversation
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { conversation_id, label_id } = await req.json();
    if (!conversation_id || !label_id) {
      return NextResponse.json({ success: false, error: "conversation_id and label_id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("inbox_conversation_labels")
      .upsert({ conversation_id, label_id } as any, { onConflict: "conversation_id,label_id" });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabase.from("inbox_events").insert({
      conversation_id,
      event_type: "label_added",
      new_value: label_id,
    } as any);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT — create new label
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { name, color } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "name required" }, { status: 400 });

    const { data, error } = await supabase
      .from("inbox_labels")
      .insert({ name, color: color || "#666666" } as any)
      .select("*")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, label: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE — remove label from conversation
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversation_id");
    const labelId = searchParams.get("label_id");

    if (!conversationId || !labelId) {
      return NextResponse.json({ success: false, error: "conversation_id and label_id required" }, { status: 400 });
    }

    await supabase
      .from("inbox_conversation_labels")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("label_id", labelId);

    await supabase.from("inbox_events").insert({
      conversation_id: conversationId,
      event_type: "label_removed",
      old_value: labelId,
    } as any);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
