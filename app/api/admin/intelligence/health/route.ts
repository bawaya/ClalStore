// =====================================================
// GET /api/admin/intelligence/health
//   Runs the catalog-wide audit. Returns structured report.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { runHealthCheck } from "@/lib/intelligence/health";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const result = await runHealthCheck();
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.health]", err);
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`health failed — ${detail}`.slice(0, 600), 500);
  }
}
