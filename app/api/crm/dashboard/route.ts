export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMDashboard } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const data = await getCRMDashboard();
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"), 500);
  }
}
