import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// GET — all labels
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { data: labels } = await supabase
      .from("inbox_labels")
      .select("*")
      .order("sort_order", { ascending: true });

    return apiSuccess({ labels: labels || [] });
  } catch (err: unknown) {
    console.error("Labels GET error:", err);
    return apiError("فشل في جلب التصنيفات", 500);
  }
}

// POST — attach label to conversation
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { conversation_id, label_id } = await req.json();
    if (!conversation_id || !label_id) {
      return apiError("conversation_id and label_id required", 400);
    }

    const { error } = await supabase
      .from("inbox_conversation_labels")
      .upsert({ conversation_id, label_id } as any, { onConflict: "conversation_id,label_id" });

    if (error) return apiError("فشل في ربط التصنيف", 500);

    await supabase.from("inbox_events").insert({
      conversation_id,
      event_type: "label_added",
      new_value: label_id,
    } as any);

    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Labels POST error:", err);
    return apiError("فشل في ربط التصنيف", 500);
  }
}

// PUT — create new label
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { name, color } = await req.json();
    if (!name) return apiError("name required", 400);

    const { data, error } = await supabase
      .from("inbox_labels")
      .insert({ name, color: color || "#666666" } as any)
      .select("*")
      .single();

    if (error) return apiError("فشل في إنشاء التصنيف", 500);
    return apiSuccess({ label: data });
  } catch (err: unknown) {
    console.error("Labels PUT error:", err);
    return apiError("فشل في إنشاء التصنيف", 500);
  }
}

// DELETE — remove label from conversation
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversation_id");
    const labelId = searchParams.get("label_id");

    if (!conversationId || !labelId) {
      return apiError("conversation_id and label_id required", 400);
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

    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Labels DELETE error:", err);
    return apiError("فشل في إزالة التصنيف", 500);
  }
}
