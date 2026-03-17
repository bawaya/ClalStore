export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 503 }
      );
    }

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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = (data ?? []).filter((n: { read: boolean }) => !n.read).length;

    return NextResponse.json({ data: data ?? [], unreadCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { user_id, type, title, body: notifBody, link, icon } = body;

    if (!title || !type) {
      return NextResponse.json(
        { error: "title and type are required" },
        { status: 400 }
      );
    }

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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 503 }
      );
    }

    const body = await req.json();

    if (body.mark_all && body.user_id) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .or(`user_id.eq.${body.user_id},user_id.is.null`)
        .eq("read", false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (body.id) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", body.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Provide id or { user_id, mark_all: true }" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
