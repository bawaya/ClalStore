/**
 * Static reference data for the sales-request form — banks list and
 * locality search. Served from the same auth boundary as the rest of
 * /api/employee/**.
 *
 *   GET /api/employee/sales-requests/reference
 *   GET /api/employee/sales-requests/reference?localities=NAME_PREFIX
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { apiSuccess, safeError } from "@/lib/api-response";
import { ACTIVE_ISRAELI_BANKS, searchBanks } from "@/lib/data/israeli-banks";
import { searchLocalities } from "@/lib/data/israeli-localities";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const { searchParams } = new URL(req.url);
    const localityQuery = searchParams.get("localities")?.trim();
    const bankQuery = searchParams.get("banks")?.trim();

    if (localityQuery !== null && localityQuery !== undefined && localityQuery !== "") {
      return apiSuccess({ localities: searchLocalities(localityQuery, 25) });
    }

    return apiSuccess({
      banks: bankQuery ? searchBanks(bankQuery) : ACTIVE_ISRAELI_BANKS,
    });
  } catch (err) {
    return safeError(err, "SalesRequestReference", "خطأ داخلي", 500);
  }
}
