export const runtime = 'edge';

// =====================================================
// ClalMobile — AI Review Generator
// Generates realistic product reviews with Arab Israeli names
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { callClaude } from "@/lib/ai/claude";

// ── Common Arab Israeli first + last names ──
const FIRST_NAMES_MALE = [
  "محمد", "أحمد", "علي", "عمر", "يوسف", "إبراهيم", "خالد", "حسن", "حسين", "سامي",
  "كريم", "أمير", "طارق", "فادي", "رامي", "وليد", "نادر", "مروان", "باسم", "جمال",
  "ماهر", "رائد", "أسامة", "منير", "نبيل", "سمير", "وسيم", "شادي", "هاني", "زياد",
  "رياض", "بلال", "عادل", "سعيد", "ماجد", "فراس", "أنس", "إياد", "عماد", "حاتم",
];
const FIRST_NAMES_FEMALE = [
  "سارة", "مريم", "نور", "هبة", "رنين", "لينا", "دانا", "ياسمين", "آية", "سلمى",
  "رنا", "ديمة", "تالا", "هديل", "جنان", "سوار", "ملك", "شهد", "روان", "لمى",
  "آلاء", "ريم", "سجود", "رغد", "وعد", "نسرين", "سهام", "سمر", "غدير", "مها",
  "إسراء", "حنين", "بيان", "سندس", "عبير", "رزان", "هيا", "أماني", "إيمان", "فاطمة",
];
const LAST_NAMES = [
  "خطيب", "زعبي", "أبو حمد", "مصاروة", "حاج يحيى", "عثامنة", "كناعنة", "حمدان",
  "طه", "جبارين", "سعدي", "دراوشة", "ناطور", "غنايم", "محاميد", "شحادة", "عمري",
  "بدير", "صرصور", "إغبارية", "يونس", "حاج", "صبّاح", "ريّان", "عبد الرحمن",
  "طاهر", "خلايلة", "دقّة", "عمّاش", "أبو ريّا", "أبو العسل", "ناصر", "مواسي",
  "كبها", "واكد", "بشارات", "شلبي", "شرقاوي", "وتد", "بيادسة", "سواعد", "جبالي",
];

function randomName(): string {
  const isFemale = Math.random() < 0.45;
  const firsts = isFemale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE;
  const first = firsts[Math.floor(Math.random() * firsts.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

/**
 * Distribute ratings realistically:
 * ~45% → 5 stars, ~30% → 4 stars, ~15% → 3 stars, ~8% → 2 stars, ~2% → 1 star
 */
function distributeRatings(count: number): number[] {
  const ratings: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.45) ratings.push(5);
    else if (r < 0.75) ratings.push(4);
    else if (r < 0.90) ratings.push(3);
    else if (r < 0.98) ratings.push(2);
    else ratings.push(1);
  }
  return ratings;
}

/** Randomize dates within the last 6 months */
function randomDate(): string {
  const now = Date.now();
  const sixMonths = 180 * 24 * 60 * 60 * 1000;
  const date = new Date(now - Math.random() * sixMonths);
  return date.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const body = await req.json();
    const { product_id, count } = body;

    if (!product_id || !count || count < 1 || count > 50) {
      return NextResponse.json({ error: "product_id and count (1-50) required" }, { status: 400 });
    }

    // Fetch product details
    const { data: product } = await db.from("products")
      .select("id, name_ar, name_he, brand, type, specs")
      .eq("id", product_id)
      .single();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Fetch existing reviews to avoid duplication
    const { data: existingReviews } = await db.from("product_reviews")
      .select("body")
      .eq("product_id", product_id);

    const existingBodies = (existingReviews || []).map((r: any) => r.body || "").filter(Boolean);

    // Build specs summary
    const specs = product.specs as Record<string, string> | null;
    const specsText = specs && Object.keys(specs).length > 0
      ? Object.entries(specs)
          .filter(([, v]) => v)
          .slice(0, 8)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "";

    // Distribute ratings
    const ratings = distributeRatings(count);

    // Generate reviews in batches of 10
    const batchSize = 10;
    const allReviews: Array<{
      product_id: string;
      customer_name: string;
      rating: number;
      title: string;
      body: string;
      verified_purchase: boolean;
      status: string;
      created_at: string;
    }> = [];

    const usedNames = new Set<string>();

    for (let i = 0; i < count; i += batchSize) {
      const batchRatings = ratings.slice(i, i + batchSize);
      const batchCount = batchRatings.length;

      // Generate unique names for this batch
      const batchNames: string[] = [];
      for (let j = 0; j < batchCount; j++) {
        let name = randomName();
        let attempts = 0;
        while (usedNames.has(name) && attempts < 20) {
          name = randomName();
          attempts++;
        }
        usedNames.add(name);
        batchNames.push(name);
      }

      const systemPrompt = `أنت مساعد لمتجر موبايلات (ClalMobile) في إسرائيل. مهمتك كتابة تقييمات واقعية بالعربية لمنتج معيّن.

قواعد مهمة:
- كل تقييم يتكون من عنوان قصير (3-6 كلمات) ونص التقييم (جملة إلى 3 جمل)
- التقييمات يجب أن تكون متنوعة وغير مكررة أبداً  
- يجب ذكر اسم المنتج أو نوعه في بعض التقييمات (ليس كلها) بشكل طبيعي
- المواضيع تتنوع بين: جودة المنتج، السعر، خدمة المتجر، سرعة التوصيل، التغليف، مقارنة بالسوق
- تقييم 5 نجوم: حماسي وإيجابي جداً (ممتاز، أفضل قرار، روعة)
- تقييم 4 نجوم: إيجابي مع ملاحظة بسيطة (جيد جداً بس...)
- تقييم 3 نجوم: متوسط مع نقد بنّاء (كان ممكن يكون أحسن)
- تقييم 2 نجوم: فيه مشاكل واضحة (مش راضي عن...)
- تقييم 1 نجمة: تجربة سيئة (للأسف، مخيّب)
- استخدم لهجة عربية عامية مفهومة (عرب 48)
- لا تكرر نفس العبارات أو التعليقات

${existingBodies.length > 0 ? `⚠️ هذه تقييمات موجودة مسبقاً، لا تكررها:\n${existingBodies.slice(0, 10).map((b: string) => `- "${b}"`).join("\n")}` : ""}

أجب فقط بـ JSON array بدون markdown أو backticks:
[{"title":"...","body":"..."},{"title":"...","body":"..."}]`;

      const reviewRequests = batchRatings.map((r, idx) => `${idx + 1}. تقييم ${r} نجوم (الاسم: ${batchNames[idx]})`).join("\n");

      const userPrompt = `المنتج: ${product.name_ar} (${product.brand})
النوع: ${product.type === "device" ? "جهاز موبايل" : "إكسسوار"}
${specsText ? `المواصفات: ${specsText}` : ""}

اكتب ${batchCount} تقييمات متنوعة وفريدة:
${reviewRequests}`;

      const result = await callClaude({
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 4000,
        temperature: 0.95,
      });

      if (!result) throw new Error("Claude API call failed");
      const raw = result.text;

      // Parse JSON
      let reviews: Array<{ title: string; body: string }> = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          reviews = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Try to extract individual objects
        const objMatches = [...raw.matchAll(/\{[^{}]*"title"[^{}]*"body"[^{}]*\}/g)];
        reviews = objMatches.map(m => {
          try { return JSON.parse(m[0]); } catch { return null; }
        }).filter(Boolean) as Array<{ title: string; body: string }>;
      }

      // Map to database records
      for (let j = 0; j < batchCount; j++) {
        const review = reviews[j] || { title: "تقييم", body: "." };
        allReviews.push({
          product_id,
          customer_name: batchNames[j],
          rating: batchRatings[j],
          title: review.title || "",
          body: review.body || "",
          verified_purchase: Math.random() < 0.6, // 60% verified
          status: "approved",
          created_at: randomDate(),
        });
      }
    }

    // Insert all reviews
    const { data: inserted, error } = await db.from("product_reviews")
      .insert(allReviews)
      .select("id");

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: inserted?.length || 0,
      message: `✅ تم توليد ${inserted?.length || 0} تقييم لـ ${product.name_ar}`,
    });
  } catch (err: any) {
    console.error("[Review Generator Error]", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}
