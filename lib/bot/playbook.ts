// =====================================================
// ClalMobile — Sales Playbook
// Product recommendation + qualification + upsell
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import type { Product, LinePlan } from "@/types/database";

const db = () => createAdminSupabase();

// ===== Budget Ranges =====
export const BUDGET_RANGES = [
  { key: "under_1500", label_ar: "حتى 1,500₪", label_he: "עד 1,500₪", min: 0, max: 1500 },
  { key: "1500_3000", label_ar: "1,500 - 3,000₪", label_he: "1,500-3,000₪", min: 1500, max: 3000 },
  { key: "3000_5000", label_ar: "3,000 - 5,000₪", label_he: "3,000-5,000₪", min: 3000, max: 5000 },
  { key: "above_5000", label_ar: "فوق 5,000₪", label_he: "מעל 5,000₪", min: 5000, max: 99999 },
] as const;

export const PRIORITY_OPTIONS = [
  { key: "camera", label_ar: "📷 كاميرا", label_he: "📷 מצלמה" },
  { key: "battery", label_ar: "🔋 بطارية", label_he: "🔋 סוללה" },
  { key: "performance", label_ar: "🎮 أداء/ألعاب", label_he: "🎮 ביצועים" },
  { key: "budget", label_ar: "💰 سعر اقتصادي", label_he: "💰 מחיר כלכלי" },
] as const;

export const BRAND_OPTIONS = [
  { key: "Apple", label_ar: "Apple 🍎", label_he: "Apple 🍎" },
  { key: "Samsung", label_ar: "Samsung 📱", label_he: "Samsung 📱" },
  { key: "Xiaomi", label_ar: "Xiaomi 🔥", label_he: "Xiaomi 🔥" },
  { key: "any", label_ar: "مش مهم", label_he: "לא משנה" },
] as const;

export const PAYMENT_OPTIONS = [
  { key: "cash", label_ar: "💵 كاش", label_he: "💵 מזומן" },
  { key: "installments", label_ar: "🏦 تقسيط حتى 18 شهر", label_he: "🏦 תשלומים עד 18 חודשים" },
] as const;

// ===== Qualification State =====
export interface QualificationState {
  budget?: string;
  priority?: string;
  brand?: string;
  payment?: string;
  step: number; // 0-4
}

export function getNextQualificationQuestion(state: QualificationState, lang: "ar" | "he" | "en"): {
  question: string;
  options: string[];
  field: string;
} | null {
  const isAr = lang !== "he";

  if (!state.budget) {
    return {
      question: isAr ? "شو الميزانية تقريباً؟ 💰" : "מה התקציב בערך? 💰",
      options: BUDGET_RANGES.map(b => isAr ? b.label_ar : b.label_he),
      field: "budget",
    };
  }
  if (!state.priority) {
    return {
      question: isAr ? "شو أهم شي بالجهاز؟ ⭐" : "מה הכי חשוב במכשיר? ⭐",
      options: PRIORITY_OPTIONS.map(p => isAr ? p.label_ar : p.label_he),
      field: "priority",
    };
  }
  if (!state.brand) {
    return {
      question: isAr ? "ماركة مفضلة؟ 📱" : "מותג מועדף? 📱",
      options: BRAND_OPTIONS.map(b => isAr ? b.label_ar : b.label_he),
      field: "brand",
    };
  }
  if (!state.payment) {
    return {
      question: isAr ? "كاش ولا تقسيط؟ 🏦" : "מזומן או תשלומים? 🏦",
      options: PAYMENT_OPTIONS.map(p => isAr ? p.label_ar : p.label_he),
      field: "payment",
    };
  }
  return null;
}

// ===== Map qualification answer to key =====
export function parseQualificationAnswer(field: string, answer: string): string | null {
  const clean = answer.replace(/[📷🔋🎮💰💵🏦🍎📱🔥⭐]/g, "").trim();

  if (field === "budget") {
    for (const b of BUDGET_RANGES) {
      if (clean.includes(b.label_ar) || clean.includes(b.label_he) || clean === b.key) return b.key;
      // Fuzzy: extract numbers
      const nums = clean.match(/\d[\d,]*/g);
      if (nums && nums.length >= 1) {
        const n = parseInt(nums[0].replace(/,/g, ""));
        if (n <= b.max && n >= b.min) return b.key;
      }
    }
    // Default ranges by rough keyword
    if (/حتى|تحت|أقل|رخيص|עד|פחות|cheap/i.test(clean)) return "under_1500";
    if (/فوق|أكثر|غالي|مع|יותר|מעל|expensive/i.test(clean)) return "above_5000";
    return "1500_3000"; // fallback mid-range
  }

  if (field === "priority") {
    if (/كاميرا|camera|מצלמה/i.test(clean)) return "camera";
    if (/بطارية|battery|סוללה/i.test(clean)) return "battery";
    if (/أداء|ألعاب|gaming|performance|ביצועים/i.test(clean)) return "performance";
    if (/سعر|اقتصادي|رخيص|budget|כלכלי|מחיר/i.test(clean)) return "budget";
    return "camera"; // fallback
  }

  if (field === "brand") {
    if (/apple|أبل|ايفون|آيفون|אייפון/i.test(clean)) return "Apple";
    if (/samsung|سامسونج|جالكسي|סמסונג|גלקסי/i.test(clean)) return "Samsung";
    if (/xiaomi|شاومي|ردمي|שיאומי/i.test(clean)) return "Xiaomi";
    return "any";
  }

  if (field === "payment") {
    if (/تقسيط|دفعات|شهر|תשלומים|installment/i.test(clean)) return "installments";
    return "cash";
  }

  return clean;
}

// ===== Product Search =====
export interface ProductSearchParams {
  brand?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  storage?: string;
  limit?: number;
  inStockOnly?: boolean;
}

export async function searchProducts(params: ProductSearchParams): Promise<Product[]> {
  const s = db();
  let q = s.from("products").select("*").eq("active", true).eq("type", "device");

  if (params.inStockOnly !== false) q = q.gt("stock", 0);
  if (params.brand && params.brand !== "any") q = q.eq("brand", params.brand);
  if (params.minPrice) q = q.gte("price", params.minPrice);
  if (params.maxPrice) q = q.lte("price", params.maxPrice);
  if (params.model) {
    q = q.ilike("name_ar", `%${params.model}%`);
  }

  const { data } = await q
    .order("featured", { ascending: false })
    .order("sold", { ascending: false })
    .limit(params.limit || 3);

  return (data as Product[]) || [];
}

// ===== Search by model name (flexible) =====
export async function searchByModel(model: string, storage?: string): Promise<Product[]> {
  const s = db();
  // Try exact name_ar match first
  let q = s.from("products").select("*").eq("active", true).gt("stock", 0);

  // Use name_ar ilike for Arabic model names
  q = q.ilike("name_ar", `%${model}%`);

  const { data } = await q.order("price", { ascending: true }).limit(5);

  if (data && data.length > 0) {
    // If storage specified, prefer exact match
    if (storage) {
      const exact = (data as Product[]).filter(p =>
        p.name_he?.toLowerCase().includes(storage.toLowerCase())
      );
      if (exact.length > 0) return exact;
    }
    return data as Product[];
  }

  // Fallback: try name_he
  const { data: data2 } = await s.from("products").select("*")
    .eq("active", true).gt("stock", 0)
    .ilike("name_he", `%${model}%`)
    .order("price", { ascending: true }).limit(5);

  return (data2 as Product[]) || [];
}

// ===== Recommend based on qualification =====
export async function recommendProducts(qualification: QualificationState): Promise<Product[]> {
  const budget = BUDGET_RANGES.find(b => b.key === qualification.budget);
  const params: ProductSearchParams = {
    brand: qualification.brand !== "any" ? qualification.brand : undefined,
    minPrice: budget?.min,
    maxPrice: budget?.max,
    limit: 3,
    inStockOnly: true,
  };

  let products = await searchProducts(params);

  // If too few results, relax brand constraint
  if (products.length < 2 && qualification.brand !== "any") {
    products = await searchProducts({ ...params, brand: undefined });
  }

  // Sort by priority
  if (qualification.priority === "budget") {
    products.sort((a, b) => Number(a.price) - Number(b.price));
  }

  return products.slice(0, 3);
}

// ===== Format product card =====
export function formatProductCard(product: Product, index: number, baseUrl: string): string {
  const price = Number(product.price).toLocaleString();
  const monthly = Math.ceil(Number(product.price) / 18).toLocaleString();
  const storage = product.name_he?.match(/(\d+(?:GB|TB))/i)?.[1] || "";
  const badge = product.featured ? " ⭐" : index === 0 ? "" : "";

  return `${index + 1}️⃣ ${product.name_ar} ${storage} — ${price}₪${badge}\n   💰 تقسيط: ${monthly}₪ × 18 شهر\n   🔗 ${baseUrl}/store/product/${product.id}`;
}

export function formatProductCards(products: Product[], baseUrl: string): string {
  if (products.length === 0) return "";
  return products.map((p, i) => formatProductCard(p, i, baseUrl)).join("\n\n");
}

// ===== Calculate installments =====
export function calculateInstallments(price: number): {
  m3: number; m6: number; m12: number; m18: number;
} {
  return {
    m3: Math.ceil(price / 3),
    m6: Math.ceil(price / 6),
    m12: Math.ceil(price / 12),
    m18: Math.ceil(price / 18),
  };
}

// ===== Compare two products =====
export function formatComparison(a: Product, b: Product, baseUrl: string): string {
  const specs = (p: Product) => {
    const s = p.specs as Record<string, string> || {};
    return Object.entries(s).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  };

  return `📊 *مقارنة:*\n\n` +
    `1️⃣ *${a.brand} ${a.name_ar}*\n` +
    `   💰 ${Number(a.price).toLocaleString()}₪\n` +
    `   📦 ${a.stock > 0 ? "متوفر ✅" : "نفذ ❌"}\n` +
    (specs(a) ? `${specs(a)}\n` : "") +
    `   🔗 ${baseUrl}/store/product/${a.id}\n\n` +
    `2️⃣ *${b.brand} ${b.name_ar}*\n` +
    `   💰 ${Number(b.price).toLocaleString()}₪\n` +
    `   📦 ${b.stock > 0 ? "متوفر ✅" : "نفذ ❌"}\n` +
    (specs(b) ? `${specs(b)}\n` : "") +
    `   🔗 ${baseUrl}/store/product/${b.id}`;
}

// ===== Line Plans =====
export async function getLinePlans(): Promise<LinePlan[]> {
  const { data } = await db()
    .from("line_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return (data || []) as LinePlan[];
}

export function formatLinePlans(plans: LinePlan[]): string {
  if (plans.length === 0) return "للاطلاع على الباقات: clalmobile.com/store";
  const list = plans.map(l =>
    `${l.popular ? "⭐ " : ""}*${l.name_ar}* — ${l.data_amount} — ₪${l.price}/شهر`
  ).join("\n");
  return `📡 *باقات HOT Mobile:*\n\n${list}`;
}

// ===== Upsell suggestions =====
export async function getUpsellSuggestions(): Promise<Product[]> {
  const { data } = await db()
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("type", "accessory")
    .gt("stock", 0)
    .order("sold", { ascending: false })
    .limit(3);
  return (data || []) as Product[];
}

// ===== Order lookup =====
export async function lookupOrder(orderId?: string, phone?: string) {
  const s = db();

  if (orderId) {
    const { data } = await s
      .from("orders")
      .select("*, order_items(*)" as any)
      .eq("id", orderId)
      .single();
    return data as any;
  }

  if (phone) {
    // Find customer first, then last order
    const { data: customer } = await s.from("customers").select("id").eq("phone", phone).single();
    if (!customer) return null;
    const { data } = await s
      .from("orders")
      .select("*, order_items(*)" as any)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data as any;
  }

  return null;
}

// ===== Customer lookup/upsert =====
export async function upsertCustomer(phone: string, name?: string, city?: string) {
  const s = db();
  const normalized = phone.replace(/[-\s()]/g, "");

  // Check existing
  const { data: existing } = await s.from("customers").select("*").eq("phone", normalized).single();
  if (existing) return existing;

  // Also check with +972 format
  const altPhone = normalized.startsWith("05")
    ? "+972" + normalized.slice(1)
    : normalized.startsWith("+972")
      ? "0" + normalized.slice(4)
      : normalized;

  const { data: existing2 } = await s.from("customers").select("*").eq("phone", altPhone).single();
  if (existing2) return existing2;

  // Create new customer
  if (name) {
    const { data: newCust } = await s.from("customers").insert({
      name: name,
      phone: normalized,
      city: city || "",
      segment: "new",
    } as any).select().single();
    return newCust;
  }

  return null;
}
