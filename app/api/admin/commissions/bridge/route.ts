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
import { apiSuccess, apiError, safeError } from "@/lib/api-response";

const RATE_LIMIT = { maxRequests: 60, windowMs: 3600_000 };

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const ip = req.headers.get("x-forwarded-for") || "bridge";
    const rl = checkRateLimit(`bridge-api:${ip.slice(-8)}`, RATE_LIMIT);
    if (!rl.allowed) {
      const res = apiError("Rate limit exceeded", 429);
      res.headers.set("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      return res;
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || undefined;
    const view = searchParams.get("view") || "dashboard";

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
    return apiSuccess(data);
  } catch (err) {
    return safeError(err, "commissions-bridge", "Internal error", 500);
  }
}
