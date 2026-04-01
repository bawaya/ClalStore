
// =====================================================
// ClalMobile — Admin Product Auto-Fill (MobileAPI / GSMArena / Combined)
// POST: { name, brand, provider? } → specs, colors, images
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchDeviceData } from "@/lib/admin/device-data";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { autofillSchema, validateBody } from "@/lib/admin/validators";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const v = validateBody(await req.json(), autofillSchema);
    if (!v.success) return apiError(v.error, 400);

    const data = await fetchDeviceData(v.data.name, v.data.brand, v.data.provider || "mobileapi");
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "فشل في جلب البيانات"), 500);
  }
}
