
import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { authenticateCustomer } from "@/lib/customer-auth";
import {
  getCustomerLoyalty,
  getLoyaltyTransactions,
  redeemPoints,
  LOYALTY_CONFIG,
  calculatePointsValue,
  getNextTier,
  pointsToNextTier,
  type TierKey,
} from "@/lib/loyalty";

export async function GET(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("unauthorized", 401);
    }

    const [loyalty, transactions] = await Promise.all([
      getCustomerLoyalty(customer.id),
      getLoyaltyTransactions(customer.id, 20),
    ]);

    const tier = (loyalty?.tier || "bronze") as TierKey;
    const lifetimePoints = loyalty?.lifetime_points || 0;
    const nextTier = getNextTier(tier);
    const tierConfig = LOYALTY_CONFIG.tiers[tier];
    const nextTierConfig = nextTier ? LOYALTY_CONFIG.tiers[nextTier] : null;

    return apiSuccess({
      loyalty: {
        points: loyalty?.points || 0,
        lifetime_points: lifetimePoints,
        tier,
        tier_label_ar: tierConfig.label_ar,
        tier_label_he: tierConfig.label_he,
        tier_color: tierConfig.color,
        tier_icon: tierConfig.icon,
        tier_multiplier: tierConfig.multiplier,
        points_value: calculatePointsValue(loyalty?.points || 0),
        next_tier: nextTier,
        next_tier_label_ar: nextTierConfig?.label_ar || null,
        next_tier_label_he: nextTierConfig?.label_he || null,
        next_tier_min: nextTierConfig?.minPoints || null,
        points_to_next: pointsToNextTier(lifetimePoints, tier),
        progress_percent: nextTierConfig
          ? Math.min(100, Math.round(
              ((lifetimePoints - tierConfig.minPoints) /
                (nextTierConfig.minPoints - tierConfig.minPoints)) * 100
            ))
          : 100,
      },
      transactions,
    });
  } catch (err) {
    console.error("Loyalty GET error:", err);
    return apiError("server_error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("unauthorized", 401);
    }

    const body = await req.json();
    const { action, points, orderId } = body;

    if (action === "redeem") {
      if (!points || typeof points !== "number" || points <= 0) {
        return apiError("invalid_points", 400);
      }

      const result = await redeemPoints(customer.id, points, orderId);

      if (!result.success) {
        return apiError(result.error || "redeem_failed", 400);
      }

      const loyalty = await getCustomerLoyalty(customer.id);
      const tier = (loyalty?.tier || "bronze") as TierKey;

      return apiSuccess({
        value: result.value,
        remaining_points: loyalty?.points || 0,
        tier,
      });
    }

    return apiError("invalid_action", 400);
  } catch (err) {
    console.error("Loyalty POST error:", err);
    return apiError("server_error", 500);
  }
}
