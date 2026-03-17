export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import {
  getCustomerLoyalty,
  getLoyaltyTransactions,
  redeemPoints,
  LOYALTY_CONFIG,
  calculateTier,
  calculatePointsValue,
  getNextTier,
  pointsToNextTier,
  type TierKey,
} from "@/lib/loyalty";

async function authenticateCustomer(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token || token.length < 32) return null;

  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("auth_token", token)
    .single();

  return customer;
}

export async function GET(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json({ success: false, error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, points, orderId } = body;

    if (action === "redeem") {
      if (!points || typeof points !== "number" || points <= 0) {
        return NextResponse.json({ success: false, error: "invalid_points" }, { status: 400 });
      }

      const result = await redeemPoints(customer.id, points, orderId);

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      const loyalty = await getCustomerLoyalty(customer.id);
      const tier = (loyalty?.tier || "bronze") as TierKey;

      return NextResponse.json({
        success: true,
        value: result.value,
        remaining_points: loyalty?.points || 0,
        tier,
      });
    }

    return NextResponse.json({ success: false, error: "invalid_action" }, { status: 400 });
  } catch (err) {
    console.error("Loyalty POST error:", err);
    return NextResponse.json({ success: false, error: "server_error" }, { status: 500 });
  }
}
