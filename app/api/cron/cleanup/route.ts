export const runtime = "edge";

// =====================================================
// ClalMobile — Cron Cleanup
// POST /api/cron/cleanup — Clean up expired rate limit entries
// Call from external cron service (e.g., cron-job.org) every hour
// Headers: Authorization: Bearer <CRON_SECRET>
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError("CRON_SECRET not configured", 503);

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) return apiError("Unauthorized", 401);

  try {
    const sb = createAdminSupabase();
    if (!sb) return apiError("DB unavailable", 500);

    // Clean up expired rate limit entries
    const { error, count } = await sb
      .from("rate_limits")
      .delete()
      .lt("reset_at", new Date().toISOString())
      .select("key", { count: "exact", head: true });

    if (error) return apiError(error.message, 500);

    return apiSuccess({
      cleaned: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}
