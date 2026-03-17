export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// POST /api/cron/backup — Data backup (structure only for now)
// Cron can call this to trigger backup. Full implementation: export to JSON, store in Supabase storage or email.
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret if configured
    const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret");
    const secret = process.env.CRON_SECRET;
    if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Backup started");
    // TODO: Export orders, customers, products to JSON; store in Supabase storage or send via email
    return NextResponse.json({ success: true, message: "Backup started" });
  } catch (err: any) {
    console.error("Backup error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
