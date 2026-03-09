export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { createAdminSupabase } from "@/lib/supabase";

// Configure web-push with VAPID keys (required for sending)
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
if (vapidPublic && vapidPrivate) {
  webPush.setVapidDetails(
    "mailto:support@clalmobile.com",
    vapidPublic,
    vapidPrivate
  );
}

// POST — Admin: Send push notification to all subscribers
export async function POST(req: NextRequest) {
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { title, body: notifBody, url, icon } = body;

    if (!title || !notifBody) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json(
        { error: "VAPID keys غير مُعدّة. أضف NEXT_PUBLIC_VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في .env.local" },
        { status: 500 }
      );
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
      icon: icon || "/icons/icon-192x192.svg",
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscribers) {
      try {
        const keys = sub.keys as { p256dh?: string; auth?: string } | null;
        if (!keys?.p256dh || !keys?.auth) continue;
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth },
          },
          payload,
          { TTL: 86400 }
        );
        sent++;
      } catch (e: any) {
        const code = e?.statusCode ?? e?.status;
        const isExpired = code === 410 || code === 404;
        if (isExpired) expiredEndpoints.push(sub.endpoint);
        console.warn("Push failed:", sub.endpoint?.slice(0, 50), code, e?.message);
      }
    }

    // Mark expired subscriptions as inactive (410 Gone / 404)
    if (expiredEndpoints.length > 0) {
      await db.from("push_subscriptions")
        .update({ active: false })
        .in("endpoint", expiredEndpoints);
    }

    // Save notification record
    const { data: notif, error } = await db.from("push_notifications").insert({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.svg",
      sent_count: sent,
      target: "all",
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      notification: notif,
      sent_to: sent,
      failed: subscribers.length - sent,
      message: `تم إرسال الإشعار إلى ${sent} مشترك${expiredEndpoints.length ? ` (${expiredEndpoints.length} اشتراك منتهي)` : ""}`,
    });
  } catch (err: any) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "فشل إرسال الإشعار" }, { status: 500 });
  }
}

// GET — Admin: Get notification history
export async function GET() {
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ notifications: [] });

    const { data } = await db.from("push_notifications")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ notifications: data || [] });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
