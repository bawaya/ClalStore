export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// POST — Subscribe to push notifications
export async function POST(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_push_notifications").single();
    if (setting?.value !== "true") return NextResponse.json({ error: "Push disabled" }, { status: 403 });

    const body = await req.json();
    const { endpoint, keys, visitor_id } = body;

    if (!endpoint || !keys) {
      return NextResponse.json({ error: "Missing subscription data" }, { status: 400 });
    }

    // Upsert by endpoint
    const { data: existing } = await db.from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .single();

    if (existing) {
      await db.from("push_subscriptions")
        .update({ keys, visitor_id, active: true })
        .eq("id", existing.id);
    } else {
      await db.from("push_subscriptions").insert({
        endpoint,
        keys,
        visitor_id,
        user_agent: req.headers.get("user-agent") || "",
        active: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Unsubscribe
export async function DELETE(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return NextResponse.json({ ok: true });

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return NextResponse.json({ ok: true });

    await db.from("push_subscriptions")
      .update({ active: false })
      .eq("endpoint", endpoint);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
