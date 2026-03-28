export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// Configure VAPID once at module level
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:info@clalmobile.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

// POST — Admin: Send push notification to all subscribers
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json();
    const { title, body: notifBody, url, icon } = body;

    if (!title || !notifBody) {
      return apiError("Missing title or body", 400);
    }

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return apiError("VAPID keys not configured", 500);
    }

    // Get all active subscriptions
    const { data: subs } = await db.from("push_subscriptions")
      .select("*")
      .eq("active", true);

    const subscribers = subs || [];
    const payload = JSON.stringify({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.png",
    });

    // Send to all subscribers, collect results
    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.allSettled(
      subscribers.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
          sent++;
        } catch (err: unknown) {
          // 410 Gone = subscription expired/unsubscribed — mark inactive
          if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
            staleIds.push(sub.id);
          }
          failed++;
        }
      })
    );

    // Deactivate stale subscriptions
    if (staleIds.length > 0) {
      await db.from("push_subscriptions")
        .update({ active: false })
        .in("id", staleIds);
    }

    // Save notification record
    const { data: notif, error } = await db.from("push_notifications").insert({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.png",
      sent_count: sent,
      target: "all",
    }).select().single();

    if (error) throw error;

    return apiSuccess({
      notification: notif,
      sent_to: sent,
      failed,
      message: `تم إرسال الإشعار إلى ${sent} مشترك`,
    });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

// GET — Admin: Get notification history
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiSuccess({ notifications: [] });

    const { data } = await db.from("push_notifications")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);

    return apiSuccess({ notifications: data || [] });
  } catch {
    return apiSuccess({ notifications: [] });
  }
}
