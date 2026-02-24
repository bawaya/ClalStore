export const runtime = "edge";

// =====================================================
// ClalMobile — Smart Search API
// GET /api/store/smart-search?q=...
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { callClaude } from "@/lib/ai/claude";
import { trackAIUsage } from "@/lib/ai/usage-tracker";

// Simple in-memory rate limiter
const rateLimit = new Map<string, number[]>();
const RATE_LIMIT = 10; // per minute per IP
const RATE_WINDOW = 60_000;

// Result cache (60 seconds)
const resultCache = new Map<string, { data: unknown; time: number }>();
const CACHE_TTL = 60_000;

interface SearchFilters {
  type?: "device" | "accessory" | null;
  brands?: string[] | null;
  min_price?: number | null;
  max_price?: number | null;
  features?: string[] | null;
  sort?: "price_asc" | "price_desc" | "rating" | "newest" | null;
  keywords?: string[] | null;
}

function isSmartQuery(q: string): boolean {
  const words = q.trim().split(/\s+/);
  if (words.length >= 3) return true;
  // Check for smart keywords
  const smartWords = [
    "تحت", "فوق", "أحسن", "أرخص", "أفضل", "أغلى", "أقوى", "أخف",
    "كاميرا", "بطارية", "شاشة", "مقاوم", "ضد",
    "under", "over", "best", "cheap", "camera", "battery",
    "מתחת", "מעל", "הכי",
  ];
  return smartWords.some((w) => q.toLowerCase().includes(w));
}

function getClientIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  rateLimit.set(ip, recent);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ success: false, error: "استعلام قصير جداً" }, { status: 400 });
    }

    // Rate limit
    const ip = getClientIP(req);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ success: false, error: "كثرة طلبات — حاول بعد دقيقة" }, { status: 429 });
    }

    // Check cache
    const cacheKey = q.toLowerCase();
    const cached = resultCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    let filters: SearchFilters = {};
    let aiUsed = false;

    // Decide: smart search or simple ILIKE
    if (isSmartQuery(q)) {
      // Smart search — use Claude to parse intent
      const systemPrompt = `أنت محرك بحث لمتجر إلكتروني. حوّل طلب العميل لفلاتر JSON.

المتجر يبيع: أجهزة (smartphones, tablets) وإكسسوارات (cases, chargers, earbuds)
الماركات: Apple, Samsung, Xiaomi, Huawei, Google, OnePlus, Honor, Oppo, ZTE وغيرها

أعد JSON فقط:
{
  "type": "device" | "accessory" | null,
  "brands": ["Apple", "Samsung"] | null,
  "min_price": number | null,
  "max_price": number | null,
  "features": ["camera", "battery", "5g", "waterproof"] | null,
  "sort": "price_asc" | "price_desc" | "rating" | "newest" | null,
  "keywords": ["iPhone", "Pro Max"] | null
}

أمثلة:
- "هاتف كاميرا حلوة تحت 3000" → {"type":"device","max_price":3000,"features":["camera"],"sort":"rating"}
- "أرخص سامسونج" → {"type":"device","brands":["Samsung"],"sort":"price_asc"}
- "كفر iPhone 16" → {"type":"accessory","keywords":["iPhone 16","case"]}
- "أحسن هاتف عندكم" → {"type":"device","sort":"rating"}
- "هاتف بطارية قوية" → {"type":"device","features":["battery"],"sort":"rating"}`;

      const result = await callClaude({
        systemPrompt,
        messages: [{ role: "user", content: q }],
        maxTokens: 200,
        temperature: 0.2,
        jsonMode: true,
        apiKey: process.env.ANTHROPIC_API_KEY_STORE || process.env.ANTHROPIC_API_KEY,
      });

      if (result?.json) {
        const j = result.json as Record<string, unknown>;
        filters = {
          type: j.type as "device" | "accessory" | null,
          brands: j.brands as string[] | null,
          min_price: j.min_price as number | null,
          max_price: j.max_price as number | null,
          features: j.features as string[] | null,
          sort: j.sort as SearchFilters["sort"],
          keywords: j.keywords as string[] | null,
        };
        aiUsed = true;

        // Track usage
        trackAIUsage({
          feature: "smart_search",
          inputTokens: result.tokens.input,
          outputTokens: result.tokens.output,
          durationMs: result.duration,
        });
      }
    }

    // If AI failed or not smart query → extract basic filters
    if (!aiUsed) {
      // Basic text-based extraction
      const lower = q.toLowerCase();
      const brandPatterns: Record<string, string[]> = {
        Apple: ["apple", "ايفون", "آيفون", "iphone", "ابل", "آبل"],
        Samsung: ["samsung", "سامسونج", "سامسونغ", "جلاكسي", "galaxy"],
        Xiaomi: ["xiaomi", "شاومي", "ريدمي", "redmi"],
        Huawei: ["huawei", "هواوي"],
        Google: ["google", "جوجل", "بيكسل", "pixel"],
      };

      const matchedBrands: string[] = [];
      for (const [brand, aliases] of Object.entries(brandPatterns)) {
        if (aliases.some((a) => lower.includes(a))) matchedBrands.push(brand);
      }
      if (matchedBrands.length) filters.brands = matchedBrands;

      // Price extraction
      const priceMatch = lower.match(/(?:تحت|أقل|under|מתחת)\s*(?:من)?\s*(\d+)/);
      if (priceMatch) filters.max_price = parseInt(priceMatch[1]);
      const priceMin = lower.match(/(?:فوق|أكثر|over|מעל)\s*(?:من)?\s*(\d+)/);
      if (priceMin) filters.min_price = parseInt(priceMin[1]);

      filters.keywords = [q];
    }

    // Build Supabase query
    let query = supabase
      .from("products")
      .select("*")
      .eq("active", true);

    if (filters.type) {
      query = query.eq("type", filters.type);
    }
    if (filters.brands?.length) {
      query = query.in("brand", filters.brands);
    }
    if (filters.max_price) {
      query = query.lte("price", filters.max_price);
    }
    if (filters.min_price) {
      query = query.gte("price", filters.min_price);
    }

    // Keywords — ILIKE search
    if (filters.keywords?.length) {
      const orFilters = filters.keywords
        .map((k) => `name_ar.ilike.%${k}%,name_he.ilike.%${k}%,brand.ilike.%${k}%`)
        .join(",");
      query = query.or(orFilters);
    }

    // Sort
    if (filters.sort === "price_asc") {
      query = query.order("price", { ascending: true });
    } else if (filters.sort === "price_desc") {
      query = query.order("price", { ascending: false });
    } else if (filters.sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else {
      // Default: featured first, then by sales
      query = query.order("featured", { ascending: false }).order("sold", { ascending: false });
    }

    query = query.limit(20);

    const { data: products, error } = await query;

    if (error) {
      console.error("Smart search query error:", error);
      return NextResponse.json({ success: false, error: "خطأ في البحث" }, { status: 500 });
    }

    const total = products?.length || 0;

    // Build suggestion text
    let suggestion = "";
    if (aiUsed && total > 0) {
      const typeLabel = filters.type === "device" ? "جهاز" : filters.type === "accessory" ? "إكسسوار" : "منتج";
      const priceText = filters.max_price ? ` تحت ₪${filters.max_price.toLocaleString()}` : "";
      const brandText = filters.brands?.length ? ` من ${filters.brands.join(" و ")}` : "";
      suggestion = `✨ وجدنا ${total} ${typeLabel}${brandText}${priceText}`;
    }

    const responseData = {
      success: true,
      filters,
      products: products || [],
      total,
      suggestion,
      ai_used: aiUsed,
    };

    // Cache result
    resultCache.set(cacheKey, { data: responseData, time: Date.now() });

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error("Smart search error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
