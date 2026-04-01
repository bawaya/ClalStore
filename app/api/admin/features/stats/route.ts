export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB unavailable", 500);

    // Gather stats for each feature — use try/catch for each in case table doesn't exist
    const stats: Record<string, any> = {};

    try {
      const { count: abandonedCount } = await supabase.from("abandoned_carts").select("*", { count: "exact", head: true }).eq("recovered", false);
      const { count: recoveredCount } = await supabase.from("abandoned_carts").select("*", { count: "exact", head: true }).eq("recovered", true);
      stats.abandoned_cart = { "سلة مهجورة": abandonedCount || 0, "تم الاسترجاع": recoveredCount || 0 };
    } catch {}

    try {
      const { count: pendingReviews } = await supabase.from("product_reviews").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: approvedReviews } = await supabase.from("product_reviews").select("*", { count: "exact", head: true }).eq("status", "approved");
      stats.reviews = { "بانتظار الموافقة": pendingReviews || 0, "منشور": approvedReviews || 0 };
    } catch {}

    try {
      const { count: subsCount } = await supabase.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("active", true);
      const { count: notifCount } = await supabase.from("push_notifications").select("*", { count: "exact", head: true });
      stats.push = { "مشترك": subsCount || 0, "إشعار مرسل": notifCount || 0 };
    } catch {}

    try {
      const { count: dealsCount } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("active", true);
      stats.deals = { "عرض فعّال": dealsCount || 0 };
    } catch {}

    return apiSuccess(stats);
  } catch {
    return apiSuccess({});
  }
}
