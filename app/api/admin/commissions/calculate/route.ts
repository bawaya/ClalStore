import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calcLineCommission, calcDeviceCommission, calcLoyaltyBonus, calcRequiredForTarget } from "@/lib/commissions/calculator";
import type { SupabaseClient } from "@supabase/supabase-js";

export const POST = withAdminAuth(async (req: NextRequest, _db: SupabaseClient) => {
  const body = await req.json();
  const { type } = body;

  if (type === "line") {
    const { packagePrice, hasValidHK, count = 1 } = body;
    if (!packagePrice) return apiError("packagePrice required", 400);
    const perLine = calcLineCommission(packagePrice, hasValidHK !== false);
    return apiSuccess({ perLine, total: perLine * count, count });
  }

  if (type === "device") {
    const { totalNetSales } = body;
    if (totalNetSales == null) return apiError("totalNetSales required", 400);
    return apiSuccess(calcDeviceCommission(totalNetSales));
  }

  if (type === "loyalty") {
    const { loyaltyStartDate } = body;
    if (!loyaltyStartDate) return apiError("loyaltyStartDate required", 400);
    return apiSuccess(calcLoyaltyBonus(loyaltyStartDate));
  }

  if (type === "target") {
    const { targetAmount, periodStart, periodEnd, currentProgress } = body;
    if (!targetAmount || !periodStart || !periodEnd) return apiError("targetAmount, periodStart, periodEnd required", 400);
    return apiSuccess(calcRequiredForTarget(targetAmount, periodStart, periodEnd, currentProgress));
  }

  return apiError("type must be 'line', 'device', 'loyalty', or 'target'", 400);
});
