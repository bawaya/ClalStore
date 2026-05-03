// =====================================================
// ClalMobile — Store Queries
// Server-side data fetching from Supabase
// =====================================================

import { createServerSupabase } from "@/lib/supabase";
import type { Product, Hero, LinePlan, Coupon, Category, WebsiteContent, CategoryKind, ProductType, StoreSpotlight } from "@/types/database";

// ===== Products =====
export async function getProducts(options?: {
  type?: ProductType;
  /** If set, only these product types (e.g. `["device","accessory"]` to exclude appliances/TVs/etc. from the main storefront). */
  types?: ProductType[];
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

  if (options?.types && options.types.length > 0) {
    query = query.in("type", options.types);
  } else if (options?.type) {
    query = query.eq("type", options.type);
  }
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

// ===== Store Spotlights (active only, sorted by position) =====
// Used by the /store page to render the editorial 1+3 spotlight grid.
// Returns up to 4 rows (one per position). The frontend joins each row to its
// product via a separate getProduct() lookup, so we don't widen the response shape.
export async function getStoreSpotlights(): Promise<StoreSpotlight[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("store_spotlights")
    .select("*")
    .eq("active", true)
    .order("position");
  return (data as StoreSpotlight[]) || [];
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
export async function getCategories(options?: { kind?: CategoryKind }): Promise<Category[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  let q = supabase.from("categories").select("*").eq("active", true);
  if (options?.kind) q = q.eq("kind", options.kind);
  const { data } = await q.order("sort_order");

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

// ===== Website Content (CMS) =====
export async function getWebsiteContent(): Promise<Record<string, WebsiteContent>> {
  const supabase = createServerSupabase();
  if (!supabase) return {};
  const { data } = await supabase
    .from("website_content")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order");

  const sections: Record<string, WebsiteContent> = {};
  (data || []).forEach((row: any) => {
    sections[row.section] = row;
  });
  return sections;
}
