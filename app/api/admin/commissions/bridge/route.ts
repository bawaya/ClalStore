// =====================================================
// ClalMobile — Commission ↔ CRM Bridge API
// Unified dashboard data — admin cookie session only.
// (The bearer-token path for the standalone HOT Mobile HTML apps was
// decommissioned together with those apps — see the cleanup commit.)
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin/auth";
import { getBridgeDashboard, getUnifiedEmployees, getSyncGaps } from "@/lib/commissions/crm-bridge";

const RATE_LIMIT = { maxRequests: 60, windowMs: 3600_000 };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Rate limit
  const ip = req.headers.get("x-forwarded-for") || "bridge";
  const rl = checkRateLimit(`bridge-api:${ip.slice(-8)}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || undefined;
  const view = searchParams.get("view") || "dashboard"; // dashboard | employees | gaps

  try {
    let data: unknown;
    switch (view) {
      case "employees":
        data = await getUnifiedEmployees();
        break;
      case "gaps":
        data = await getSyncGaps(month);
        break;
      default:
        data = await getBridgeDashboard(month);
    }
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
