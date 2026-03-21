export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// POST /api/cron/backup — Data backup placeholder
// Not yet implemented — returns 501 to avoid false confidence
export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret");
  if (auth !== `Bearer ${cronSecret}` && auth !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Backup not yet implemented — return 501 so monitoring tools catch it
  return NextResponse.json(
    { success: false, error: "Backup not implemented yet. Use Supabase dashboard for manual backups." },
    { status: 501 }
  );
}
