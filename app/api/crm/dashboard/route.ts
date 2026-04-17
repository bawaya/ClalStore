
import { NextRequest, NextResponse } from "next/server";
import { getCRMDashboard } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("dateFrom") || undefined;
    const dateTo = url.searchParams.get("dateTo") || undefined;
    const data = await getCRMDashboard({ dateFrom, dateTo });
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("CRM Dashboard error:", err);
    return apiError("فشل في جلب بيانات اللوحة", 500);
  }
}
