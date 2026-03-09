// =====================================================
// ClalMobile — Store Queries
// Server-side data fetching from Supabase
// =====================================================

import { createServerSupabase } from "@/lib/supabase";
import type { Product, Hero, LinePlan, Coupon, Category, WebsiteContent } from "@/types/database";

/** ترتيب: آيفون أولاً، جلاكسي ثانياً، ثم بريميوم → متوسط → اقتصادي */
export function sortProductsByBrandAndTier(products: Product[]): Product[] {
  const getPriceTier = (p: Product): number => {
    const price = p.price || 0;
    if (price >= 3500) return 0; // بريميوم
    if (price >= 1500) return 1;  // متوسط
    return 2;                     // اقتصادي
  };
  const getBrandOrder = (p: Product): number => {
    const br = (p.brand || "").toLowerCase();
    if (br === "apple") return 0;
    if (br === "samsung") return 1;
    return 2;
  };
  const getModelGen = (p: Product): number => {
    const name = ((p.name_ar || "") + " " + (p.name_he || "")).toLowerCase();
    const nums = name.match(/(?:iphone|آيفون|galaxy|جالكسي|s|a|z\s*(?:fold|flip|فولد|فليب))\s*(\d+)/gi);
    if (nums) {
      const extracted = nums.map((m) => { const d = m.match(/(\d+)/); return d ? parseInt(d[1]) : 0; });
      return Math.max(...extracted);
    }
    const yearMatch = name.match(/20(\d{2})/);
    if (yearMatch) return parseInt(yearMatch[1]);
    const anyNum = name.match(/(\d+)/);
    return anyNum ? parseInt(anyNum[1]) : 0;
  };
  return [...products].sort((a, b) => {
    const hasImgA = a.image_url ? 1 : 0;
    const hasImgB = b.image_url ? 1 : 0;
    if (hasImgA !== hasImgB) return hasImgB - hasImgA;
    const bo = getBrandOrder(a) - getBrandOrder(b);
    if (bo !== 0) return bo;
    const ta = getPriceTier(a), tb = getPriceTier(b);
    if (ta !== tb) return ta - tb;
    if (a.price !== b.price) return b.price - a.price;
    const genA = getModelGen(a), genB = getModelGen(b);
    if (genA !== genB) return genB - genA;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return (b.sold || 0) - (a.sold || 0);
  });
}

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
  let list = (data as Product[]) || [];
  const sorted = sortProductsByBrandAndTier(list);

  const { data: settingsRows } = await supabase.from("settings").select("value").eq("key", "priority_product_ids").single();
  let priorityIds: string[] = [];
  try {
    const raw = settingsRows?.value;
    if (raw) priorityIds = JSON.parse(raw);
    if (!Array.isArray(priorityIds)) priorityIds = [];
  } catch {}
  priorityIds = priorityIds.slice(0, 3).filter(Boolean);

  if (priorityIds.length > 0) {
    const byId = new Map(sorted.map((p) => [p.id, p]));
    const ordered = priorityIds.map((id) => byId.get(id)).filter(Boolean) as Product[];
    const rest = sorted.filter((p) => !priorityIds.includes(p.id));
    list = [...ordered, ...rest];
  } else {
    list = sorted;
  }
  return list;
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
