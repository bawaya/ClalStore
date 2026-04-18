// =====================================================
// ClalMobile — Commission ↔ CRM Bridge API
// Unified dashboard data — supports admin auth + bearer token
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin/auth";
import { getBridgeDashboard, getUnifiedEmployees, getSyncGaps } from "@/lib/commissions/crm-bridge";
import { corsHeaders as sharedCorsHeaders } from "@/lib/commissions/cors";
import { safeTokenEqual } from "@/lib/commissions/safe-compare";

const RATE_LIMIT = { maxRequests: 60, windowMs: 3600_000 };

// Preserve this route's historical "wildcard when unset" behaviour.
function corsHeaders(origin?: string | null): Record<string, string> {
  return sharedCorsHeaders(origin, { wildcardWhenUnset: true });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Authenticate via admin session OR bearer token */
async function authenticate(req: NextRequest): Promise<boolean> {
  // 1. Bearer token (for external HTML apps)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const validToken = process.env.COMMISSION_API_TOKEN;
  if (safeTokenEqual(token, validToken)) return true;

  // 2. Admin session (cookie-based via Supabase SSR)
  const result = await requireAdmin(req);
  return !(result instanceof NextResponse);
}

export async function GET(req: NextRequest) {
  const authed = await authenticate(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  // Rate limit
  const ip = req.headers.get("x-forwarded-for") || "bridge";
  const rl = checkRateLimit(`bridge-api:${ip.slice(-8)}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
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
    return NextResponse.json({ ok: true, data }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: corsHeaders() });
  }
}
