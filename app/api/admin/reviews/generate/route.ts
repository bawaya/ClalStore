
// =====================================================
// ClalMobile — AI Review Generator
// Generates realistic product reviews with Arab + Jewish Israeli names
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { callClaude } from "@/lib/ai/claude";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// ── Common Arab Israeli first + last names ──
const FIRST_NAMES_MALE_AR = [
  "محمد", "أحمد", "علي", "عمر", "يوسف", "إبراهيم", "خالد", "حسن", "حسين", "سامي",
  "كريم", "أمير", "طارق", "فادي", "رامي", "وليد", "نادر", "مروان", "باسم", "جمال",
  "ماهر", "رائد", "أسامة", "منير", "نبيل", "سمير", "وسيم", "شادي", "هاني", "زياد",
  "رياض", "بلال", "عادل", "سعيد", "ماجد", "فراس", "أنس", "إياد", "عماد", "حاتم",
];
const FIRST_NAMES_FEMALE_AR = [
  "سارة", "مريم", "نور", "هبة", "رنين", "لينا", "دانا", "ياسمين", "آية", "سلمى",
  "رنا", "ديمة", "تالا", "هديل", "جنان", "سوار", "ملك", "شهد", "روان", "لمى",
  "آلاء", "ريم", "سجود", "رغد", "وعد", "نسرين", "سهام", "سمر", "غدير", "مها",
  "إسراء", "حنين", "بيان", "سندس", "عبير", "رزان", "هيا", "أماني", "إيمان", "فاطمة",
];
const LAST_NAMES_AR = [
  "خطيب", "زعبي", "أبو حمد", "مصاروة", "حاج يحيى", "عثامنة", "كناعنة", "حمدان",
  "طه", "جبارين", "سعدي", "دراوشة", "ناطور", "غنايم", "محاميد", "شحادة", "عمري",
  "بدير", "صرصور", "إغبارية", "يونس", "حاج", "صبّاح", "ريّان", "عبد الرحمن",
  "طاهر", "خلايلة", "دقّة", "عمّاش", "أبو ريّا", "أبو العسل", "ناصر", "مواسي",
  "كبها", "واكد", "بشارات", "شلبي", "شرقاوي", "وتد", "بيادسة", "سواعد", "جبالي",
];

// ── Common Jewish Israeli first + last names ──
const FIRST_NAMES_MALE_HE = [
  "يوسي", "دافيد", "موشيه", "أفي", "يانيف", "إيتان", "عومر", "إيدو", "شاي", "يوناتان",
  "أورن", "غيل", "نوعام", "إيلان", "رون", "أساف", "عيدو", "دور", "ليئور", "نير",
  "آريه", "بوعاز", "عوفر", "تومر", "إلعاد", "ألون", "نداف", "يارون", "عوديد", "أمنون",
  "مئير", "تسحاق", "شلومو", "يعقوب", "حاييم", "بنيامين", "إيهود", "دان", "باراك", "غادي",
];
const FIRST_NAMES_FEMALE_HE = [
  "ميراف", "شيرا", "نوعا", "ليئات", "يائيل", "طال", "عينات", "أورلي", "دانيئلا", "مايا",
  "هيلا", "شيري", "كيرن", "ليمور", "أوريت", "ميخال", "عيديت", "غاليت", "سيغال", "روني",
  "طاليا", "أييلت", "نوريت", "أوفيرا", "ياعيل", "حين", "ليهي", "أديل", "شوشانا", "يوديت",
  "رينا", "تمار", "مورييت", "إفرات", "ناعمه", "حداسا", "ليئورا", "عنات", "أورنا", "ديكلا",
];
const LAST_NAMES_HE = [
  "كوهين", "ليفي", "مزراحي", "بيرتس", "أبراهام", "فريدمان", "شابيرا", "غولدشتاين",
  "أزولاي", "دهان", "بن دافيد", "أوحيون", "بيتون", "حدّاد", "يوسف", "أغامي",
  "بن شمعون", "كاتس", "مالكا", "حزان", "روزنبرغ", "شوارتس", "ساسون", "بن حاييم",
  "عمار", "غابسو", "بن عامي", "أشكنازي", "هرتسوغ", "سيغال", "لاهاف", "باروخ",
  "شالوم", "ألموغ", "كريسبين", "نحمياس", "أبو", "طوبيا", "حلفون", "ألبز",
];

function randomName(): { name: string; isJewish: boolean } {
  // ~40% Jewish names, ~60% Arab names
  const isJewish = Math.random() < 0.40;
  const isFemale = Math.random() < 0.45;

  if (isJewish) {
    const firsts = isFemale ? FIRST_NAMES_FEMALE_HE : FIRST_NAMES_MALE_HE;
    const first = firsts[Math.floor(Math.random() * firsts.length)];
    const last = LAST_NAMES_HE[Math.floor(Math.random() * LAST_NAMES_HE.length)];
    return { name: `${first} ${last}`, isJewish: true };
  } else {
    const firsts = isFemale ? FIRST_NAMES_FEMALE_AR : FIRST_NAMES_MALE_AR;
    const first = firsts[Math.floor(Math.random() * firsts.length)];
    const last = LAST_NAMES_AR[Math.floor(Math.random() * LAST_NAMES_AR.length)];
    return { name: `${first} ${last}`, isJewish: false };
  }
}

/**
 * Distribute ratings — mostly positive (~97% positive):
 * ~60% → 5 stars, ~33% → 4 stars, ~4% → 3 stars, ~2% → 2 stars, ~1% → 1 star
 */
function distributeRatings(count: number): number[] {
  const ratings: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.60) ratings.push(5);       // 60% — 5 stars
    else if (r < 0.93) ratings.push(4);  // 33% — 4 stars
    else if (r < 0.97) ratings.push(3);  // 4%  — 3 stars (mild)
    else if (r < 0.99) ratings.push(2);  // 2%  — 2 stars (rare)
    else ratings.push(1);                // 1%  — 1 star (very rare)
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
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    if (!process.env.ANTHROPIC_API_KEY_ADMIN && !process.env.ANTHROPIC_API_KEY) {
      return apiError("Anthropic Admin API key not configured", 500);
    }
    const aiKey = process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || "";

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB unavailable", 500);

    const body = await req.json();
    const { product_id, count, distribution } = body as {
      product_id: string;
      count: number;
      distribution?: { star5: number; star4: number; star3: number; star2: number; star1: number };
    };

    if (!product_id || !count || count < 1 || count > 50) {
      return apiError("product_id and count (1-50) required", 400);
    }

    // Fetch product details
    const { data: product } = await supabase.from("products")
      .select("id, name_ar, name_he, brand, type, specs")
      .eq("id", product_id)
      .single();

    if (!product) {
      return apiError("Product not found", 404);
    }

    // Fetch existing reviews to avoid duplication
    const { data: existingReviews } = await supabase.from("product_reviews")
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

    // Distribute ratings — manual or auto
    let ratings: number[];
    if (distribution) {
      ratings = [];
      for (let s = 0; s < (distribution.star5 || 0); s++) ratings.push(5);
      for (let s = 0; s < (distribution.star4 || 0); s++) ratings.push(4);
      for (let s = 0; s < (distribution.star3 || 0); s++) ratings.push(3);
      for (let s = 0; s < (distribution.star2 || 0); s++) ratings.push(2);
      for (let s = 0; s < (distribution.star1 || 0); s++) ratings.push(1);
      // Shuffle
      for (let i = ratings.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ratings[i], ratings[j]] = [ratings[j], ratings[i]];
      }
    } else {
      ratings = distributeRatings(count);
    }

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
      const batchIsJewish: boolean[] = [];
      for (let j = 0; j < batchCount; j++) {
        let result = randomName();
        let attempts = 0;
        while (usedNames.has(result.name) && attempts < 20) {
          result = randomName();
          attempts++;
        }
        usedNames.add(result.name);
        batchNames.push(result.name);
        batchIsJewish.push(result.isJewish);
      }

      const systemPrompt = `أنت مساعد لمتجر موبايلات (ClalMobile) في إسرائيل. مهمتك كتابة تقييمات واقعية لمنتج معيّن.
المتجر يخدم زبائن عرب ويهود.

قواعد مهمة:
- كل تقييم يتكون من عنوان قصير (3-6 كلمات) ونص التقييم (جملة إلى 3 جمل)
- التقييمات يجب أن تكون متنوعة وغير مكررة أبداً  
- يجب ذكر اسم المنتج أو نوعه في بعض التقييمات (ليس كلها) بشكل طبيعي
- المواضيع تتنوع بين: جودة المنتج، السعر، خدمة المتجر، سرعة التوصيل، التغليف، مقارنة بالسوق
- الغالبية العظمى من التقييمات يجب أن تكون إيجابية ومثالية (~97% إيجابية)
- تقييم 5 نجوم: حماسي وإيجابي جداً، مبسوط ومتحمس
- تقييم 4 نجوم: إيجابي مع ملاحظة بسيطة خفيفة جداً
- تقييم 3 نجوم: نقد خفيف وبنّاء وبأدب
- تقييم 2 نجوم: زعلان قليلاً بس مش كثير سلبي
- تقييم 1 نجمة: غاضب قليلاً ولكن بأسلوب محترم

قواعد اللغة (مهم جداً):
- إذا مكتوب "[عبري]" بجانب الاسم — اكتب العنوان والنص بالعبرية فقط! عبرية يومية طبيعية وعامية إسرائيلية. أمثلة: מעולה, מומלץ בחום, שירות מצוין, הגיע מהר
- إذا مكتوب "[عربي]" بجانب الاسم — اكتب بالعربية بلهجة عرب 48 العامية (ممتاز، الله يعطيكم العافية، روعة)
- لا تخلط بين اللغتين — كل تقييم بلغة واحدة فقط حسب التعليمات
- لا تكرر نفس العبارات أو التعليقات

${existingBodies.length > 0 ? `⚠️ هذه تقييمات موجودة مسبقاً، لا تكررها:\n${existingBodies.slice(0, 10).map((b: string) => `- "${b}"`).join("\n")}` : ""}

أجب فقط بـ JSON array بدون markdown أو backticks:
[{"title":"...","body":"..."},{"title":"...","body":"..."}]`;

      const reviewRequests = batchRatings.map((r, idx) => {
        const lang = batchIsJewish[idx] ? "[عبري]" : "[عربي]";
        return `${idx + 1}. تقييم ${r} نجوم (الاسم: ${batchNames[idx]}) ${lang}`;
      }).join("\n");

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
        timeout: 60000,
        apiKey: aiKey,
      });

      if (!result) throw new Error("Claude API call failed — تأكد من ANTHROPIC_API_KEY_ADMIN");
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
    const { data: inserted, error } = await supabase.from("product_reviews")
      .insert(allReviews)
      .select("id");

    if (error) throw error;

    return apiSuccess({
      count: inserted?.length || 0,
      message: `✅ تم توليد ${inserted?.length || 0} تقييم لـ ${product.name_ar}`,
    });
  } catch (err: unknown) {
    console.error("[Review Generator Error]", err);
    return apiError("فشل في توليد التقييمات", 500);
  }
}
