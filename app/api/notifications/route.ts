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
    if (error) { console.error("Notifications GET error:", error); return apiError("فشل في جلب الإشعارات", 500); }

    const unreadCount = (data ?? []).filter((n: { read: boolean }) => !n.read).length;
    return apiSuccess({ notifications: data ?? [], unreadCount });
  } catch (err: unknown) {
    console.error("Notifications GET error:", err);
    return apiError("فشل في جلب الإشعارات", 500);
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

    if (error) { console.error("Notifications POST error:", error); return apiError("فشل في إنشاء الإشعار", 500); }
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Notifications POST error:", err);
    return apiError("فشل في إنشاء الإشعار", 500);
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

      if (error) { console.error("Notifications mark_all error:", error); return apiError("فشل في تحديث الإشعارات", 500); }
      return apiSuccess(null);
    }

    if (body.id) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", body.id);

      if (error) { console.error("Notifications read error:", error); return apiError("فشل في تحديث الإشعار", 500); }
      return apiSuccess(null);
    }

    return apiError("Provide id or { user_id, mark_all: true }", 400);
  } catch (err: unknown) {
    console.error("Notifications PATCH error:", err);
    return apiError("فشل في تحديث الإشعارات", 500);
  }
}
