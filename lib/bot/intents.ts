// =====================================================
// ClalMobile — Bot Intent Detection
// Keyword matching + pattern recognition (no AI/LLM)
// =====================================================

export type BotIntent =
  | "buy_now"
  | "compare"
  | "price_inquiry"
  | "installment_info"
  | "specs_inquiry"
  | "availability"
  | "shipping_info"
  | "warranty_return"
  | "order_tracking"
  | "line_plans"
  | "contact_info"
  | "complaint"
  | "human_request"
  | "greeting"
  | "thanks"
  | "csat_response"
  | "unknown";

export interface DetectedIntent {
  intent: BotIntent;
  params: Record<string, string | number | undefined>;
  confidence: number;
  language: "ar" | "he" | "en";
}

// ===== Language Detection =====
const HE_PATTERN = /[\u0590-\u05FF]/;
const AR_PATTERN = /[\u0600-\u06FF]/;

export function detectLanguage(text: string): "ar" | "he" | "en" {
  if (HE_PATTERN.test(text)) return "he";
  if (AR_PATTERN.test(text)) return "ar";
  // Check for English keywords
  if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text)) return "en";
  return "ar"; // default
}

// ===== Brand Extraction =====
const BRAND_MAP: Record<string, string> = {
  // Apple
  apple: "Apple", أبل: "Apple", ايفون: "Apple", آيفون: "Apple",
  iphone: "Apple", iphon: "Apple", ايفن: "Apple", אייפון: "Apple",
  // Samsung
  samsung: "Samsung", سامسونج: "Samsung", سامسونغ: "Samsung",
  galaxy: "Samsung", جالكسي: "Samsung", גלקסי: "Samsung", סמסונג: "Samsung",
  // Xiaomi
  xiaomi: "Xiaomi", شاومي: "Xiaomi", شياومي: "Xiaomi",
  redmi: "Xiaomi", ردمي: "Xiaomi", poco: "Xiaomi", بوكو: "Xiaomi", שיאומי: "Xiaomi",
  // Oppo
  oppo: "Oppo", أوبو: "Oppo", اوبو: "Oppo",
  // Google
  google: "Google", pixel: "Google", بيكسل: "Google", جوجل: "Google",
  // ZTE
  zte: "ZTE", كوشر: "ZTE",
};

// ===== Model Extraction =====
const MODEL_PATTERNS: { pattern: RegExp; model: string; brand: string }[] = [
  // iPhone models
  { pattern: /(?:آيفون|ايفون|iphone)\s*17\s*(?:pro\s*max|برو\s*ماكس)/i, model: "iPhone 17 Pro Max", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*17\s*(?:pro|برو)/i, model: "iPhone 17 Pro", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*17\s*(?:air|اير)/i, model: "iPhone 17 Air", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*17/i, model: "iPhone 17", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*16\s*(?:pro\s*max|برو\s*ماكس)/i, model: "iPhone 16 Pro Max", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*16\s*(?:pro|برو)/i, model: "iPhone 16 Pro", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*16\s*(?:plus|بلس)/i, model: "iPhone 16 Plus", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*16\s*e/i, model: "iPhone 16e", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*16/i, model: "iPhone 16", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*15\s*(?:pro\s*max|برو\s*ماكس)/i, model: "iPhone 15 Pro Max", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*15\s*(?:pro|برو)/i, model: "iPhone 15 Pro", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*15/i, model: "iPhone 15", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*14/i, model: "iPhone 14", brand: "Apple" },
  { pattern: /(?:آيفون|ايفون|iphone)\s*13/i, model: "iPhone 13", brand: "Apple" },
  // Samsung S series
  { pattern: /(?:جالكسي|galaxy)\s*s25\s*(?:ultra|الترا)/i, model: "Galaxy S25 Ultra", brand: "Samsung" },
  { pattern: /(?:جالكسي|galaxy)\s*s25\s*(?:edge|ايدج)/i, model: "Galaxy S25 Edge", brand: "Samsung" },
  { pattern: /(?:جالكسي|galaxy)\s*s25\s*(?:fe)/i, model: "Galaxy S25 FE", brand: "Samsung" },
  { pattern: /(?:جالكسي|galaxy)\s*s25\s*(?:plus|\+|بلس)/i, model: "Galaxy S25+", brand: "Samsung" },
  { pattern: /(?:جالكسي|galaxy)\s*s25/i, model: "Galaxy S25", brand: "Samsung" },
  { pattern: /(?:جالكسي|galaxy)\s*s24\s*(?:ultra|الترا)/i, model: "Galaxy S24 Ultra", brand: "Samsung" },
  { pattern: /(?:جالكسي|galaxy)\s*s24/i, model: "Galaxy S24", brand: "Samsung" },
  // Samsung Z
  { pattern: /(?:z\s*flip|فليب)\s*7/i, model: "Galaxy Z Flip7", brand: "Samsung" },
  { pattern: /(?:z\s*flip|فليب)\s*6/i, model: "Galaxy Z Flip6", brand: "Samsung" },
  { pattern: /(?:z\s*fold|فولد)\s*7/i, model: "Galaxy Z Fold7", brand: "Samsung" },
  { pattern: /(?:z\s*fold|فولد)\s*6/i, model: "Galaxy Z Fold6", brand: "Samsung" },
  // Samsung A
  { pattern: /(?:جالكسي|galaxy)\s*a(\d+)/i, model: "Galaxy A$1", brand: "Samsung" },
  // Xiaomi
  { pattern: /(?:شاومي|xiaomi)\s*15t\s*(?:pro|برو)/i, model: "Xiaomi 15T Pro", brand: "Xiaomi" },
  { pattern: /(?:شاومي|xiaomi)\s*15t/i, model: "Xiaomi 15T 5G", brand: "Xiaomi" },
  { pattern: /(?:ردمي|redmi)\s*note\s*14\s*(?:pro\s*\+|pro\s*plus|برو\s*بلس)/i, model: "Redmi Note 14 Pro+ 5G", brand: "Xiaomi" },
  { pattern: /(?:ردمي|redmi)\s*note\s*14/i, model: "Redmi Note 14 Pro 5G", brand: "Xiaomi" },
  { pattern: /(?:بوكو|poco)\s*x7/i, model: "Poco X7 Pro 5G", brand: "Xiaomi" },
];

// ===== Storage Extraction =====
function extractStorage(text: string): string | undefined {
  const m = text.match(/(\d+)\s*(?:gb|جيجا|גיגה)/i);
  if (m) return `${m[1]}GB`;
  const tb = text.match(/(\d+)\s*(?:tb|تيرا|טרה)/i);
  if (tb) return `${tb[1]}TB`;
  return undefined;
}

// ===== Price Range Extraction =====
function extractPriceRange(text: string): { min?: number; max?: number } {
  // "حتى 3000" or "تحت 3000"
  const underM = text.match(/(?:حتى|تحت|اقل من|أقل من|עד|פחות מ)\s*(\d[\d,]*)/);
  if (underM) return { max: parseInt(underM[1].replace(/,/g, "")) };
  // "فوق 5000" or "أكثر من 5000"
  const overM = text.match(/(?:فوق|أكثر من|اكثر من|מעל|יותר מ)\s*(\d[\d,]*)/);
  if (overM) return { min: parseInt(overM[1].replace(/,/g, "")) };
  // range "2000-4000" or "بين 2000 و 4000"
  const rangeM = text.match(/(\d[\d,]*)\s*[-–و]\s*(\d[\d,]*)/);
  if (rangeM) return { min: parseInt(rangeM[1].replace(/,/g, "")), max: parseInt(rangeM[2].replace(/,/g, "")) };
  return {};
}

// ===== Main Intent Detection =====
export function detectIntent(message: string): DetectedIntent {
  const text = message.trim();
  const lower = text.toLowerCase();
  const lang = detectLanguage(text);

  // 1. CSAT response
  if (/^(👍|👎|نعم|لا|כן)$/i.test(text.trim())) {
    return { intent: "csat_response", params: { response: text.trim() }, confidence: 0.95, language: lang };
  }

  // 2. Order tracking — CLM-XXXXX pattern
  const orderMatch = lower.match(/clm-\d{4,6}/i);
  if (orderMatch) {
    return { intent: "order_tracking", params: { orderId: orderMatch[0].toUpperCase() }, confidence: 0.95, language: lang };
  }

  // 3. Explicit human request — MUST be before buy_now since "بدي" can overlap
  if (/موظف|بشر|شخص|حقيقي|נציג|אדם|human|agent|أتكلم مع|بدي احكي|اتواصل مع|تواصل مع|احكي مع|كلم |ابغى اكلم|بدي اكلم|ابي اتكلم|ممكن احكي|بدي اتواصل|ابغى اتواصل|اتكلم مع/i.test(lower)) {
    return { intent: "human_request", params: {}, confidence: 0.9, language: lang };
  }

  // 3.5 Contact info request (address, phone, how to reach)
  if (/عنوان|وين أنتم|فين أنتم|وين انتم|فين انتم|عنوانكم|كيف اوصل|כתובת|איפה אתם|مكانكم|فرع|فين المحل|وين المحل|رقم.*محل|رقم.*تلفون|رقم.*هاتف|رقمكم|اتصل بكم|تلفونكم|هاتفكم|وين مكانكم/i.test(lower)) {
    return { intent: "contact_info", params: {}, confidence: 0.9, language: lang };
  }

  // 4. Complaint / anger
  if (/مشكلة|شكوى|شكاوى|غضب|مش راضي|غلط|خرب|خربان|نصب|תלונה|בעיה|لا يشتغل|ما يشتغل|ما اشتغل/i.test(lower)) {
    return { intent: "complaint", params: {}, confidence: 0.85, language: lang };
  }

  // 5. Model-specific search (buy_now)
  for (const mp of MODEL_PATTERNS) {
    const m = mp.pattern.exec(text);
    if (m) {
      const model = mp.model.includes("$1") && m[1] ? mp.model.replace("$1", m[1]) : mp.model;
      const storage = extractStorage(text);
      return {
        intent: "buy_now",
        params: { model, brand: mp.brand, ...(storage ? { storage } : {}) },
        confidence: 0.9,
        language: lang,
      };
    }
  }

  // 6. Compare
  if (/فرق|مقارنة|ولا|أفضل|احسن|השוואה|מה ההבדל|compare|vs|versus/i.test(lower)) {
    // Try to extract two brands/models
    const brands: string[] = [];
    for (const [kw, brand] of Object.entries(BRAND_MAP)) {
      if (lower.includes(kw) && !brands.includes(brand)) brands.push(brand);
    }
    return { intent: "compare", params: { brands: brands.join(",") }, confidence: 0.8, language: lang };
  }

  // 7. Installment info
  if (/قسط|تقسيط|دفعات|دفعة|שהר|תשלומים|תשלום|installment|شهري/i.test(lower)) {
    return { intent: "installment_info", params: {}, confidence: 0.85, language: lang };
  }

  // 8. Specs inquiry
  if (/كاميرا|بطارية|رام|شاشة|معالج|مواصفات|specs|מפרט|מצלמה|סוללה|ram|camera|battery/i.test(lower)) {
    return { intent: "specs_inquiry", params: {}, confidence: 0.8, language: lang };
  }

  // 9. Price inquiry
  if (/سعر|كم|ثمن|מחיר|כמה|price|how much/i.test(lower)) {
    // Check if a brand is mentioned
    for (const [kw, brand] of Object.entries(BRAND_MAP)) {
      if (lower.includes(kw)) {
        const storage = extractStorage(text);
        const priceRange = extractPriceRange(text);
        return {
          intent: "price_inquiry",
          params: { brand, ...(storage ? { storage } : {}), ...priceRange },
          confidence: 0.85,
          language: lang,
        };
      }
    }
    return { intent: "price_inquiry", params: extractPriceRange(text), confidence: 0.75, language: lang };
  }

  // 10. Availability
  if (/متوفر|بالمخزون|عندكم|موجود|במלאי|יש לכם|in stock|available/i.test(lower)) {
    for (const [kw, brand] of Object.entries(BRAND_MAP)) {
      if (lower.includes(kw)) {
        return { intent: "availability", params: { brand }, confidence: 0.85, language: lang };
      }
    }
    return { intent: "availability", params: {}, confidence: 0.7, language: lang };
  }

  // 11. Shipping
  if (/توصيل|شحن|يوصل|كم يوم|مناطق|משלוח|שליחות|delivery|shipping/i.test(lower)) {
    return { intent: "shipping_info", params: {}, confidence: 0.85, language: lang };
  }

  // 12. Warranty / Return
  if (/ضمان|ارجاع|استرجاع|إرجاع|ارجع|אחריות|החזרה|warranty|return/i.test(lower)) {
    return { intent: "warranty_return", params: {}, confidence: 0.85, language: lang };
  }

  // 13. Order tracking (generic)
  if (/طلب|طلبي|وين طلبي|حالة الطلب|הזמנה|track|order/i.test(lower)) {
    return { intent: "order_tracking", params: {}, confidence: 0.75, language: lang };
  }

  // 14. Line plans
  if (/باقة|خط|باقات|خطوط|داتا|إنترنت|hot mobile|هوت|חבילה|קו|חבילות/i.test(lower)) {
    return { intent: "line_plans", params: {}, confidence: 0.85, language: lang };
  }

  // 15. Brand-only mention → buy_now
  for (const [kw, brand] of Object.entries(BRAND_MAP)) {
    if (lower.includes(kw)) {
      const storage = extractStorage(text);
      const priceRange = extractPriceRange(text);
      return {
        intent: "buy_now",
        params: { brand, ...(storage ? { storage } : {}), ...priceRange },
        confidence: 0.7,
        language: lang,
      };
    }
  }

  // 16. Generic buy intent — exclude communication verbs
  if (/أبغى|أبي|بدي|أريد|اطلب|أشتري|شراء|اريد|ابغى|ابي|רוצה|לקנות|buy|want/i.test(lower)
    && !/احكي|اتواصل|اكلم|اتكلم|موظف|شخص|contact|talk|speak/i.test(lower)) {
    const priceRange = extractPriceRange(text);
    return { intent: "buy_now", params: priceRange, confidence: 0.6, language: lang };
  }

  // 17. Greeting
  if (/^(مرحبا|هلا|أهلا|اهلا|السلام عليكم|هاي|שלום|היי|hi|hello|hey|صباح|مساء)/i.test(lower)) {
    return { intent: "greeting", params: {}, confidence: 0.9, language: lang };
  }

  // 18. Thanks
  if (/شكرا|مشكور|يعطيك|يسلمو|thanks|thank|תודה/i.test(lower)) {
    return { intent: "thanks", params: {}, confidence: 0.9, language: lang };
  }

  return { intent: "unknown", params: {}, confidence: 0, language: lang };
}
