// =====================================================
// ClalMobile — Product Context for AI (RAG)
// Loads product catalog for Claude context
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

interface ProductEntry {
  id: string;
  type: string;
  brand: string;
  name_ar: string;
  price: number;
  old_price?: number;
  stock: number;
  sold: number;
  colors: { hex: string; name_ar: string }[];
  storage_options: string[];
  specs: Record<string, string>;
  featured: boolean;
}

// In-memory cache — 5 minutes
let cachedCatalog: string | null = null;
let cachedProducts: ProductEntry[] = [];
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadProducts(): Promise<ProductEntry[]> {
  if (Date.now() - cacheTime < CACHE_TTL && cachedProducts.length > 0) {
    return cachedProducts;
  }

  try {
    const s = createAdminSupabase();
    if (!s) return [];

    const { data, error } = await s
      .from("products")
      .select("id, type, brand, name_ar, price, old_price, stock, sold, colors, storage_options, specs, featured")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("sold", { ascending: false })
      .limit(500);

    if (error || !data) return [];

    cachedProducts = data as ProductEntry[];
    cacheTime = Date.now();
    return cachedProducts;
  } catch {
    return [];
  }
}

function formatProduct(p: ProductEntry): string {
  const icon = p.type === "device" ? "📱" : "🎧";
  const status = p.stock > 0 ? `✅ متوفر (${p.stock} قطعة)` : "❌ غير متوفر";

  let text = `${icon} ${p.name_ar} — ${p.brand}\n`;
  text += `النوع: ${p.type === "device" ? "جهاز" : "إكسسوار"}\n`;

  if (p.colors?.length > 0) {
    text += `الألوان: ${p.colors.map((c) => c.name_ar).join("، ")}\n`;
  }

  if (p.storage_options?.length > 0) {
    text += `السعات: ${p.storage_options.join("، ")}\n`;
  }

  if (p.old_price && p.old_price > p.price) {
    text += `السعر: ₪${p.price.toLocaleString()} (بدل ₪${p.old_price.toLocaleString()} — خصم!)\n`;
  } else {
    text += `السعر: ₪${p.price.toLocaleString()}\n`;
  }

  text += `المتوفر: ${status}\n`;

  // Specs
  const specKeys = Object.keys(p.specs || {});
  if (specKeys.length > 0) {
    const specParts = specKeys.map((k) => `${k}: ${p.specs[k]}`).join("، ");
    text += `المواصفات: ${specParts}\n`;
  }

  if (p.featured) {
    text += `⭐ منتج مميز\n`;
  }

  return text;
}

/** Get full product catalog as text for AI context */
export async function getProductCatalog(): Promise<string> {
  if (Date.now() - cacheTime < CACHE_TTL && cachedCatalog) {
    return cachedCatalog;
  }

  const products = await loadProducts();
  if (products.length === 0) return "";

  let text = "=== كتالوج المنتجات ===\n\n";
  text += products.map(formatProduct).join("\n");
  text += `\n\nإجمالي المنتجات: ${products.length}`;

  cachedCatalog = text;
  return text;
}

/** Search products by query — returns matching products only (fewer tokens) */
export async function getProductByQuery(query: string): Promise<string> {
  const products = await loadProducts();
  if (products.length === 0) return "";

  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length > 1);

  // Score each product
  const scored = products.map((p) => {
    let score = 0;
    const searchable = `${p.name_ar} ${p.brand} ${p.type} ${p.colors?.map((c) => c.name_ar).join(" ") || ""} ${p.storage_options?.join(" ") || ""}`.toLowerCase();

    for (const term of terms) {
      if (searchable.includes(term)) score += 2;
      if (p.brand.toLowerCase() === term) score += 3;
      if (p.name_ar.toLowerCase().includes(term)) score += 3;
    }

    // Brand aliases
    const brandMap: Record<string, string[]> = {
      apple: ["ايفون", "آيفون", "iphone", "ابل", "آبل"],
      samsung: ["سامسونج", "سامسونغ", "جلاكسي", "galaxy"],
      xiaomi: ["شاومي", "ريدمي", "redmi", "poco"],
      huawei: ["هواوي"],
      google: ["جوجل", "بيكسل", "pixel"],
    };

    for (const [brand, aliases] of Object.entries(brandMap)) {
      if (p.brand.toLowerCase() === brand) {
        for (const alias of aliases) {
          if (q.includes(alias)) score += 3;
        }
      }
    }

    return { product: p, score };
  });

  const matches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (matches.length === 0) {
    // Return top 5 most popular as fallback
    return products.slice(0, 5).map(formatProduct).join("\n");
  }

  return matches.map((m) => formatProduct(m.product)).join("\n");
}
