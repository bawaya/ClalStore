
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("Server configuration error", 503);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data, error } = await query;
    if (error) return apiError(error.message, 500);

    const unreadCount = (data ?? []).filter((n: { read: boolean }) => !n.read).length;
    return apiSuccess({ notifications: data ?? [], unreadCount });
  } catch (err: unknown) {
    console.error("[Notifications GET]", err);
    return apiError("Failed to load notifications");
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("Server configuration error", 503);

    const body = await req.json();
    const { user_id, type, title, body: notifBody, link, icon } = body;

    if (!title || !type) return apiError("title and type are required", 400);

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: user_id ?? null,
        type,
        title,
        body: notifBody ?? null,
        link: link ?? null,
        icon: icon ?? "🔔",
        read: false,
      })
      .select()
      .single();

    if (error) return apiError(error.message, 500);
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("[Notifications POST]", err);
    return apiError("Failed to create notification");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("Server configuration error", 503);

    const body = await req.json();

    if (body.mark_all && body.user_id) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .or(`user_id.eq.${body.user_id},user_id.is.null`)
        .eq("read", false);

      if (error) return apiError(error.message, 500);
      return apiSuccess(null);
    }

    if (body.id) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", body.id);

      if (error) return apiError(error.message, 500);
      return apiSuccess(null);
    }

    return apiError("Provide id or { user_id, mark_all: true }", 400);
  } catch (err: unknown) {
    console.error("[Notifications PATCH]", err);
    return apiError("Failed to update notifications");
  }
}
