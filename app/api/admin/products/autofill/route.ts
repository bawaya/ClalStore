// =====================================================
// ClalMobile — Admin Product Auto-Fill (MobileAPI / GSMArena / Combined)
// POST: { name, brand, provider? } → specs, colors, images
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchDeviceData, type DeviceProvider } from "@/lib/admin/device-data";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";

function mapDeviceProvider(provider: string | undefined): DeviceProvider {
  if (!provider) return "mobileapi";
  if (provider === "GSMArena") return "gsmarena";
  if (provider === "Combined") return "combined";
  return "mobileapi";
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { name, brand, provider } = await req.json();

    if (!name || !brand) {
      return apiError("أدخل اسم المنتج والشركة", 400);
    }

    let resolvedProvider = provider;
    if (!resolvedProvider) {
      const { integration } = await getIntegrationByTypeWithSecrets("device_data");
      resolvedProvider = integration?.provider || "MobileAPI.dev";
    }

    const data = await fetchDeviceData(name, brand, mapDeviceProvider(resolvedProvider));
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Autofill error:", err);
    return apiError("فشل في جلب البيانات", 500);
  }
}
