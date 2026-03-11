import { createAdminSupabase } from "@/lib/supabase";
import type { LoyaltyPoints, LoyaltyTransaction } from "@/types/database";

export const LOYALTY_CONFIG = {
  pointsPerShekel: 1,
  shekelPerPoint: 0.1,
  tiers: {
    bronze:   { minPoints: 0,    multiplier: 1,    label_ar: 'برونزي',   label_he: 'ארד',      color: '#cd7f32', icon: '🥉' },
    silver:   { minPoints: 500,  multiplier: 1.25, label_ar: 'فضي',      label_he: 'כסף',      color: '#c0c0c0', icon: '🥈' },
    gold:     { minPoints: 2000, multiplier: 1.5,  label_ar: 'ذهبي',     label_he: 'זהב',      color: '#ffd700', icon: '🥇' },
    platinum: { minPoints: 5000, multiplier: 2,    label_ar: 'بلاتيني',  label_he: 'פלטינום',  color: '#e5e4e2', icon: '💎' },
  },
} as const;

export type TierKey = keyof typeof LOYALTY_CONFIG.tiers;

const TIER_ORDER: TierKey[] = ['bronze', 'silver', 'gold', 'platinum'];

export function calculateTier(lifetimePoints: number): TierKey {
  let result: TierKey = 'bronze';
  for (const tier of TIER_ORDER) {
    if (lifetimePoints >= LOYALTY_CONFIG.tiers[tier].minPoints) {
      result = tier;
    }
  }
  return result;
}

export function getNextTier(currentTier: TierKey): TierKey | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

export function pointsToNextTier(lifetimePoints: number, currentTier: TierKey): number {
  const next = getNextTier(currentTier);
  if (!next) return 0;
  return Math.max(0, LOYALTY_CONFIG.tiers[next].minPoints - lifetimePoints);
}

export function calculatePointsForOrder(total: number, tier: TierKey): number {
  const base = Math.floor(total * LOYALTY_CONFIG.pointsPerShekel);
  const multiplier = LOYALTY_CONFIG.tiers[tier].multiplier;
  return Math.floor(base * multiplier);
}

export function calculatePointsValue(points: number): number {
  return Math.round(points * LOYALTY_CONFIG.shekelPerPoint * 100) / 100;
}

// ── Server-side functions (use admin supabase) ──

async function getOrCreateLoyalty(customerId: string): Promise<LoyaltyPoints> {
  const supabase = createAdminSupabase();

  const { data: existing } = await supabase
    .from("loyalty_points")
    .select("*")
    .eq("customer_id", customerId)
    .single();

  if (existing) return existing as LoyaltyPoints;

  const { data: created, error } = await supabase
    .from("loyalty_points")
    .insert({ customer_id: customerId, points: 0, lifetime_points: 0, tier: "bronze" })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create loyalty record: ${error.message}`);
  return created as LoyaltyPoints;
}

export async function earnPoints(
  customerId: string,
  orderId: string,
  orderTotal: number
): Promise<void> {
  const supabase = createAdminSupabase();
  const loyalty = await getOrCreateLoyalty(customerId);

  const tier = loyalty.tier as TierKey;
  const earned = calculatePointsForOrder(orderTotal, tier);
  if (earned <= 0) return;

  const newPoints = loyalty.points + earned;
  const newLifetime = loyalty.lifetime_points + earned;
  const newTier = calculateTier(newLifetime);

  await supabase
    .from("loyalty_points")
    .update({
      points: newPoints,
      lifetime_points: newLifetime,
      tier: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loyalty.id);

  await supabase
    .from("loyalty_transactions")
    .insert({
      customer_id: customerId,
      type: "earn",
      points: earned,
      balance_after: newPoints,
      description: `Order ${orderId}`,
      order_id: orderId,
    });
}

export async function redeemPoints(
  customerId: string,
  points: number,
  orderId?: string
): Promise<{ success: boolean; error?: string; value?: number }> {
  const supabase = createAdminSupabase();
  const loyalty = await getOrCreateLoyalty(customerId);

  if (points <= 0) return { success: false, error: "invalid_amount" };
  if (points > loyalty.points) return { success: false, error: "not_enough_points" };

  const newBalance = loyalty.points - points;
  const value = calculatePointsValue(points);

  await supabase
    .from("loyalty_points")
    .update({
      points: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loyalty.id);

  await supabase
    .from("loyalty_transactions")
    .insert({
      customer_id: customerId,
      type: "redeem",
      points: -points,
      balance_after: newBalance,
      description: orderId ? `Redeemed for order ${orderId}` : "Points redeemed",
      order_id: orderId || null,
    });

  return { success: true, value };
}

export async function getCustomerLoyalty(customerId: string): Promise<LoyaltyPoints | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("loyalty_points")
    .select("*")
    .eq("customer_id", customerId)
    .single();

  return (data as LoyaltyPoints) || null;
}

export async function getLoyaltyTransactions(
  customerId: string,
  limit = 10
): Promise<LoyaltyTransaction[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as LoyaltyTransaction[]) || [];
}
