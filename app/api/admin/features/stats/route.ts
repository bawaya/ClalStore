export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({});

    // Gather stats for each feature — use try/catch for each in case table doesn't exist
    const stats: Record<string, any> = {};

    try {
      const { count: abandonedCount } = await db.from("abandoned_carts").select("*", { count: "exact", head: true }).eq("recovered", false);
      const { count: recoveredCount } = await db.from("abandoned_carts").select("*", { count: "exact", head: true }).eq("recovered", true);
      stats.abandoned_cart = { "سلة مهجورة": abandonedCount || 0, "تم الاسترجاع": recoveredCount || 0 };
    } catch {}

    try {
      const { count: pendingReviews } = await db.from("product_reviews").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: approvedReviews } = await db.from("product_reviews").select("*", { count: "exact", head: true }).eq("status", "approved");
      stats.reviews = { "بانتظار الموافقة": pendingReviews || 0, "منشور": approvedReviews || 0 };
    } catch {}

    try {
      const { count: subsCount } = await db.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("active", true);
      const { count: notifCount } = await db.from("push_notifications").select("*", { count: "exact", head: true });
      stats.push = { "مشترك": subsCount || 0, "إشعار مرسل": notifCount || 0 };
    } catch {}

    try {
      const { count: dealsCount } = await db.from("deals").select("*", { count: "exact", head: true }).eq("active", true);
      stats.deals = { "عرض فعّال": dealsCount || 0 };
    } catch {}

    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({});
  }
}
