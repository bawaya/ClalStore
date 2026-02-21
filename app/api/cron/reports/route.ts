export const runtime = 'edge';

// =====================================================
// ClalMobile — Cron Reports Trigger
// POST /api/cron/reports — sends daily/weekly report links via WhatsApp
// Call this from an external cron service (e.g., cron-job.org)
// Headers: Authorization: Bearer <CRON_SECRET>
// Body: { "type": "daily" } or { "type": "weekly" }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { sendDailyReportLink, sendWeeklyReportLink } from "@/lib/bot/admin-notify";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "clal-cron-2025";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const type = body.type || "daily";

    if (type === "weekly") {
      await sendWeeklyReportLink();
      return NextResponse.json({ success: true, type: "weekly", sent: true });
    }

    await sendDailyReportLink();
    return NextResponse.json({ success: true, type: "daily", sent: true });
  } catch (err: any) {
    console.error("Cron report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Also allow GET for easy testing
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "daily";
  const secret = req.nextUrl.searchParams.get("secret") || "";
  const cronSecret = process.env.CRON_SECRET || "clal-cron-2025";

  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Provide ?secret= parameter" }, { status: 401 });
  }

  try {
    if (type === "weekly") {
      await sendWeeklyReportLink();
    } else {
      await sendDailyReportLink();
    }
    return NextResponse.json({ success: true, type, sent: true });
  } catch (err: any) {
    console.error("Cron report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
