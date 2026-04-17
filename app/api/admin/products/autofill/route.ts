// =====================================================
// ClalMobile — Admin Product Auto-Fill (MobileAPI / GSMArena / Combined)
// POST: { name, brand, provider? } → specs, colors, images
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchDeviceData } from "@/lib/admin/device-data";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { name, brand, provider } = await req.json();

    if (!name || !brand) {
      return apiError("أدخل اسم المنتج والشركة", 400);
    }

    const data = await fetchDeviceData(name, brand, provider || "mobileapi");
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Autofill error:", err);
    return apiError("فشل في جلب البيانات", 500);
  }
}
