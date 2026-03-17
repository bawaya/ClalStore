export const runtime = 'edge';

// =====================================================
// ClalMobile — Weekly Report (Formatted HTML Page)
// GET /api/reports/weekly?date=2025-01-15
// Shows: week overview, orders, revenue trends, top products
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { buildWeeklyReportHtml, buildWeeklyReportPdf, getWeeklyReportData } from "@/lib/reports/service";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || "";
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;
  if (cronSecret && (secret === cronSecret || authHeader === `Bearer ${cronSecret}`)) {
    authorized = true;
  }
  if (!authorized) {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
  }

  const dateParam = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const format = (req.nextUrl.searchParams.get("format") || "html").toLowerCase();
  const data = await getWeeklyReportData(dateParam);

  if (format === "pdf") {
    const pdf = await buildWeeklyReportPdf(data);
    const body = new Uint8Array(pdf.byteLength);
    body.set(pdf);
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="weekly-report-${data.startDate}-to-${data.endDate}.pdf"`,
      },
    });
  }

  const html = buildWeeklyReportHtml(data);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
