// =====================================================
// ClalMobile — Store Queries
// Server-side data fetching from Supabase
// =====================================================

import { createServerSupabase } from "@/lib/supabase";
import type { Product, Hero, LinePlan, Coupon, Category } from "@/types/database";

// ===== Products =====
export async function getProducts(options?: {
  type?: "device" | "accessory";
  brand?: string;
  featured?: boolean;
  limit?: number;
}): Promise<Product[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("sold", { ascending: false });

  if (options?.type) query = query.eq("type", options.type);
  if (options?.brand) query = query.eq("brand", options.brand);
  if (options?.featured) query = query.eq("featured", true);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }
  return (data as Product[]) || [];
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .single();

  if (error) return null;
  return data as Product;
}

// ===== Heroes =====
export async function getHeroes(): Promise<Hero[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("heroes")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  return (data as Hero[]) || [];
}

// ===== Line Plans =====
export async function getLinePlans(): Promise<LinePlan[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("line_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  return (data as LinePlan[]) || [];
}

// ===== Categories =====
export async function getCategories(): Promise<Category[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  return (data as Category[]) || [];
}

// ===== Coupons =====
export async function validateCoupon(
  code: string,
  orderTotal: number
): Promise<{ valid: boolean; discount: number; message: string }> {
  const supabase = createServerSupabase();
  if (!supabase) return { valid: false, discount: 0, message: "خدمة غير متاحة" };

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("active", true)
    .single();

  if (!coupon) {
    return { valid: false, discount: 0, message: "كوبون غير صالح" };
  }

  const c = coupon as Coupon;

  // Check expiry
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return { valid: false, discount: 0, message: "كوبون منتهي الصلاحية" };
  }

  // Check max uses
  if (c.max_uses > 0 && c.used_count >= c.max_uses) {
    return { valid: false, discount: 0, message: "الكوبون استُنفذ" };
  }

  // Check minimum order
  if (orderTotal < c.min_order) {
    return {
      valid: false,
      discount: 0,
      message: `الحد الأدنى للطلب ₪${c.min_order}`,
    };
  }

  // Calculate discount
  const discount =
    c.type === "percent"
      ? Math.round(orderTotal * (c.value / 100))
      : Math.min(c.value, orderTotal);

  return { valid: true, discount, message: `خصم ${c.type === "percent" ? c.value + "%" : "₪" + c.value}` };
}

// ===== Settings =====
export async function getSettings(): Promise<Record<string, string>> {
  const supabase = createServerSupabase();
  if (!supabase) return {};
  const { data } = await supabase.from("settings").select("*");

  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    settings[row.key] = row.value;
  });
  return settings;
}
