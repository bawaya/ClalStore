export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// POST — Subscribe to push notifications
export async function POST(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return apiError("DB unavailable", 500);

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_push_notifications").single();
    if (setting?.value !== "true") return apiError("Push disabled", 403);

    const body = await req.json();
    const { endpoint, keys, visitor_id } = body;

    if (!endpoint || !keys) {
      return apiError("Missing subscription data", 400);
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

    return apiSuccess({ ok: true });
  } catch (err: unknown) {
    console.error("[PushSubscribe]", err);
    return apiError("Failed to subscribe", 500);
  }
}

// DELETE — Unsubscribe
export async function DELETE(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return apiSuccess({ ok: true });

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return apiSuccess({ ok: true });

    await db.from("push_subscriptions")
      .update({ active: false })
      .eq("endpoint", endpoint);

    return apiSuccess({ ok: true });
  } catch {
    return apiSuccess({ ok: true });
  }
}
