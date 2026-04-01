
// =====================================================
// ClalMobile — Cron Reports Trigger
// POST /api/cron/reports — sends daily/weekly report links via WhatsApp
// Call this from an external cron service (e.g., cron-job.org)
// Headers: Authorization: Bearer <CRON_SECRET>
// Body: { "type": "daily" } or { "type": "weekly" }
// =====================================================

import { NextRequest } from "next/server";
import { sendDailyReportLink, sendWeeklyReportLink } from "@/lib/bot/admin-notify";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  // Verify cron secret — reject if not configured
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError("CRON_SECRET not configured", 503);

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) return apiError("Unauthorized", 401);

  try {
    const body = await req.json();
    const type = body.type || "daily";

    if (type === "weekly") {
      await sendWeeklyReportLink();
      return apiSuccess({ type: "weekly", sent: true });
    }

    await sendDailyReportLink();
    return apiSuccess({ type: "daily", sent: true });
  } catch (err: unknown) {
    console.error("Cron report error:", err);
    return apiError(errMsg(err), 500);
  }
}

// Also allow GET for easy testing
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "daily";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError("CRON_SECRET not configured", 503);

  const secret = req.nextUrl.searchParams.get("secret") || "";
  if (secret !== cronSecret) return apiError("Provide ?secret= parameter", 401);

  try {
    if (type === "weekly") {
      await sendWeeklyReportLink();
    } else {
      await sendDailyReportLink();
    }
    return apiSuccess({ type, sent: true });
  } catch (err: unknown) {
    console.error("Cron report error:", err);
    return apiError(errMsg(err), 500);
  }
}
