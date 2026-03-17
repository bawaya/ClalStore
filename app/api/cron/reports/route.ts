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
import { getIntegrationConfig } from "@/lib/integrations/hub";

type ScheduleConfig = {
  timezone: string;
  dailyTime: string;
  weeklyDay: string;
  weeklyTime: string;
};

function getLocalNowParts(timeZone: string) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = fmt.find((p) => p.type === "weekday")?.value || "";
  const hour = fmt.find((p) => p.type === "hour")?.value || "00";
  const minute = fmt.find((p) => p.type === "minute")?.value || "00";
  return { weekday, hhmm: `${hour}:${minute}` };
}

function normalizeDay(v: string): string {
  const val = String(v || "").toLowerCase();
  const map: Record<string, string> = {
    sun: "sunday",
    sunday: "sunday",
    mon: "monday",
    monday: "monday",
    tue: "tuesday",
    tuesday: "tuesday",
    wed: "wednesday",
    wednesday: "wednesday",
    thu: "thursday",
    thursday: "thursday",
    fri: "friday",
    friday: "friday",
    sat: "saturday",
    saturday: "saturday",
  };
  return map[val] || "thursday";
}

function normalizeTime(v: string, fallback: string): string {
  const m = String(v || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

async function loadSchedule(): Promise<ScheduleConfig> {
  const cfg = await getIntegrationConfig("whatsapp");
  return {
    timezone: cfg.reports_timezone || "Asia/Jerusalem",
    dailyTime: normalizeTime(cfg.daily_report_time, "15:00"),
    weeklyDay: normalizeDay(cfg.weekly_report_day || "thursday"),
    weeklyTime: normalizeTime(cfg.weekly_report_time, "22:00"),
  };
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "clal-cron-2025";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type || "auto";
    const schedule = await loadSchedule();

    if (type === "auto") {
      const now = getLocalNowParts(schedule.timezone);
      const weekday = now.weekday.toLowerCase();
      if (now.hhmm === schedule.dailyTime) {
        await sendDailyReportLink();
        return NextResponse.json({ success: true, type: "daily", sent: true, at: now.hhmm, tz: schedule.timezone });
      }
      if (weekday === schedule.weeklyDay && now.hhmm === schedule.weeklyTime) {
        await sendWeeklyReportLink();
        return NextResponse.json({ success: true, type: "weekly", sent: true, at: now.hhmm, tz: schedule.timezone });
      }
      return NextResponse.json({
        success: true,
        sent: false,
        reason: "Outside scheduled time",
        now,
        schedule,
      });
    }

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
    if (type === "auto") {
      const schedule = await loadSchedule();
      const now = getLocalNowParts(schedule.timezone);
      const weekday = now.weekday.toLowerCase();
      if (now.hhmm === schedule.dailyTime) {
        await sendDailyReportLink();
        return NextResponse.json({ success: true, type: "daily", sent: true, at: now.hhmm, tz: schedule.timezone });
      }
      if (weekday === schedule.weeklyDay && now.hhmm === schedule.weeklyTime) {
        await sendWeeklyReportLink();
        return NextResponse.json({ success: true, type: "weekly", sent: true, at: now.hhmm, tz: schedule.timezone });
      }
      return NextResponse.json({
        success: true,
        sent: false,
        reason: "Outside scheduled time",
        now,
        schedule,
      });
    } else if (type === "weekly") {
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
