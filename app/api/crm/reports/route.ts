export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "daily";
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const secret = process.env.CRON_SECRET || "";

  const baseUrl = req.nextUrl.origin;
  const endpoint = type === "weekly" ? "weekly" : "daily";

  try {
    const res = await fetch(`${baseUrl}/api/reports/${endpoint}?date=${date}&secret=${encodeURIComponent(secret)}`, {
      headers: {
        "Authorization": `Bearer ${secret}`,
        "x-internal-call": "crm-reports",
      },
    });

    const html = await res.text();
    return new NextResponse(html, {
      status: res.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load report" }, { status: 500 });
  }
}
