export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin AI Enhance API (OpenAI GPT-4o-mini)
// POST: translate name, generate descriptions, classify, SEO
// =====================================================

import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_ADMIN || process.env.OPENAI_API_KEY || "";

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { name_en, brand, specs, type } = body;

    if (!name_en?.trim()) {
      return NextResponse.json({ error: "name_en is required" }, { status: 400 });
    }

    // Build specs summary for description generation
    const specsText = specs && Object.keys(specs).length > 0
      ? Object.entries(specs)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "";

    const systemPrompt = `أنت مساعد ذكي لمتجر موبايلات إسرائيلي (ClalMobile). يخدم عملاء عرب ويهود.

مهمتك: توليد وصف تسويقي جذاب بالعربي والعبري.

قواعد مهمة جداً:
- ⚠️ اسم المنتج (name_ar و name_he) يجب أن يبقى بالإنجليزية كما هو بدون أي ترجمة أو تعريب أو تعبرت
- مثال صحيح: iPhone 16 Pro Max → name_ar: "iPhone 16 Pro Max", name_he: "iPhone 16 Pro Max"
- مثال خاطئ: iPhone 16 Pro Max → name_ar: "آيفون 16 برو ماكس" ❌
- الأرقام والرموز (5G, NFC, 128GB, A55, S25) تبقى كما هي

قواعد الوصف التسويقي:
- إذا توجد مواصفات: اكتب وصف من 2-4 جمل يذكر أهم المميزات بأسلوب تسويقي مشوّق
  مثال: "iPhone 16 Pro Max — أقوى آيفون! شاشة 6.9 بوصة Super Retina XDR، كاميرا خارقة 48MP، معالج A18 Pro، بطارية 4685mAh وشحن سريع 27W. مقاومة الماء IP68."
- إذا لا توجد مواصفات: اكتب جملة أو جملتين عامتين جذابتين
- اذكر المواصفات المهمة: الشاشة، الكاميرا، المعالج، البطارية، مقاومة الماء، الشحن
- استخدم عبارات تسويقية مثل: تصميم أنيق، أداء خارق، تجربة فريدة، كاميرا مذهلة
- أبقِ الأرقام والوحدات كما هي (MP, mAh, W, inches)
- الوصف العبري بنفس المستوى والتفصيل
- إكسسوارات: في الوصف فقط ترجم (case → كفر / כיסוי, charger → شاحن / מטען) لكن الاسم يبقى بالإنجليزية

أجب فقط بـ JSON بدون markdown أو backticks:
{"name_ar":"...","name_he":"...","description_ar":"...","description_he":"...","type":"device|accessory","slug":"..."}`;

    const userPrompt = `اسم المنتج بالإنجليزي: "${name_en}"
الماركة: "${brand || ""}"
النوع الحالي: "${type || "device"}"
${specsText ? `المواصفات التفصيلية: ${specsText}` : "لا توجد مواصفات"}

ترجم الاسم واكتب وصف تسويقي مفصّل وجذاب يذكر أهم المواصفات بأسلوب مشوّق (بالعربي والعبري). حدد النوع (device أو accessory). اعمل slug بالإنجليزي.`;

    const raw = await callOpenAI(systemPrompt, userPrompt);

    // Parse JSON from response (handle markdown wrapping)
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    return NextResponse.json({
      success: true,
      data: {
        name_ar: result.name_ar || "",
        name_he: result.name_he || "",
        description_ar: result.description_ar || "",
        description_he: result.description_he || "",
        type: result.type || type || "device",
        slug: result.slug || "",
      },
    });
  } catch (err: any) {
    console.error("[AI Enhance Error]", err);
    return NextResponse.json({ error: err.message || "AI processing failed" }, { status: 500 });
  }
}
