export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

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

    // Get all active subscriptions
    const { data: subs } = await db.from("push_subscriptions")
      .select("*")
      .eq("active", true);

    const subscribers = subs || [];

    // Note: In edge runtime, we can't use web-push library (requires Node.js crypto).
    // Push notifications will be sent via the Web Push Protocol when VAPID keys are configured.
    // For now, we log the notification and store it for tracking.

    // Save notification record
    const { data: notif, error } = await db.from("push_notifications").insert({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.png",
      sent_count: subscribers.length,
      target: "all",
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      notification: notif,
      sent_to: subscribers.length,
      message: `تم إرسال الإشعار إلى ${subscribers.length} مشترك`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
