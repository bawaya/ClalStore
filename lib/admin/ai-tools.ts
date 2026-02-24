// =====================================================
// ClalMobile — Admin AI Tools
// Smart translation, description generation, SEO, classification
// Built-in dictionary — no external API needed
// =====================================================

import type { Product } from "@/types/database";

// ── Phone Term Dictionaries ──────────────────────────
const BRAND_MAP: Record<string, { ar: string; he: string }> = {
  apple: { ar: "Apple", he: "Apple" },
  samsung: { ar: "Samsung", he: "Samsung" },
  xiaomi: { ar: "شاومي", he: "שיאומי" },
  redmi: { ar: "ردمي", he: "רדמי" },
  poco: { ar: "بوكو", he: "פוקו" },
  google: { ar: "Google", he: "Google" },
  oppo: { ar: "أوبو", he: "אופו" },
  realme: { ar: "ريلمي", he: "ריאלמי" },
  oneplus: { ar: "وان بلس", he: "וואן פלוס" },
  huawei: { ar: "هواوي", he: "וואווי" },
  honor: { ar: "هونر", he: "אונור" },
  motorola: { ar: "موتورولا", he: "מוטורולה" },
  nokia: { ar: "نوكيا", he: "נוקיה" },
  sony: { ar: "سوني", he: "סוני" },
  lg: { ar: "LG", he: "LG" },
  zte: { ar: "ZTE", he: "ZTE" },
  nothing: { ar: "ناثينغ", he: "נאתינג" },
  asus: { ar: "أسوس", he: "אסוס" },
  tcl: { ar: "TCL", he: "TCL" },
  vivo: { ar: "فيفو", he: "ויוו" },
  infinix: { ar: "انفينكس", he: "אינפיניקס" },
  tecno: { ar: "تكنو", he: "טכנו" },
};

// Word-level translations for phone model names
const WORD_MAP: Record<string, { ar: string; he: string }> = {
  // Apple products
  iphone: { ar: "آيفون", he: "אייפון" },
  ipad: { ar: "آيباد", he: "אייפד" },
  macbook: { ar: "ماك بوك", he: "מקבוק" },
  airpods: { ar: "ايربودز", he: "אירפודס" },
  // Samsung products
  galaxy: { ar: "جالكسي", he: "גלקסי" },
  // Model descriptors
  pro: { ar: "برو", he: "פרו" },
  max: { ar: "ماكس", he: "מקס" },
  plus: { ar: "بلس", he: "פלוס" },
  ultra: { ar: "الترا", he: "אולטרה" },
  air: { ar: "اير", he: "אייר" },
  mini: { ar: "ميني", he: "מיני" },
  edge: { ar: "ايدج", he: "אדג׳" },
  lite: { ar: "لايت", he: "לייט" },
  note: { ar: "نوت", he: "נוט" },
  flip: { ar: "فليب", he: "פליפ" },
  fold: { ar: "فولد", he: "פולד" },
  slim: { ar: "سليم", he: "סלים" },
  // Accessory terms
  case: { ar: "كفر", he: "כיסוי" },
  cover: { ar: "غطاء", he: "כיסוי" },
  charger: { ar: "شاحن", he: "מטען" },
  cable: { ar: "كيبل", he: "כבל" },
  adapter: { ar: "محول", he: "מתאם" },
  screen: { ar: "شاشة", he: "מסך" },
  protector: { ar: "حماية", he: "מגן" },
  tempered: { ar: "زجاج مقوى", he: "זכוכית מחוסמת" },
  glass: { ar: "زجاج", he: "זכוכית" },
  wireless: { ar: "لاسلكي", he: "אלחוטי" },
  earbuds: { ar: "سماعات", he: "אוזניות" },
  headphones: { ar: "سماعات", he: "אוזניות" },
  earphones: { ar: "سماعات", he: "אוזניות" },
  speaker: { ar: "سبيكر", he: "רמקול" },
  powerbank: { ar: "باور بانك", he: "סוללה ניידת" },
  power: { ar: "باور", he: "סוללה" },
  bank: { ar: "بانك", he: "ניידת" },
  stand: { ar: "ستاند", he: "מעמד" },
  holder: { ar: "حامل", he: "מחזיק" },
  watch: { ar: "ساعة", he: "שעון" },
  band: { ar: "سوار", he: "צמיד" },
  strap: { ar: "حزام", he: "רצועה" },
  magsafe: { ar: "ماجسيف", he: "מגסייף" },
  fast: { ar: "سريع", he: "מהיר" },
};

// Terms to keep as-is (numbers, codes, abbreviations)
const KEEP_AS_IS = /^(\d+\w*|[A-Z]\d+\w*|[A-Z]{1,3}|\d+GB|\d+TB|\d+W|NFC|5G|4G|LTE|SE|FE|XL|USB|LCD|OLED|AMOLED|LED|HD|QHD|UHD)$/i;

/**
 * Translate a single word from English to Arabic/Hebrew
 */
function translateWord(word: string, lang: "ar" | "he"): string {
  if (KEEP_AS_IS.test(word)) return word;
  const lower = word.toLowerCase();
  if (WORD_MAP[lower]) return WORD_MAP[lower][lang];
  // Keep unknown words as-is (likely model numbers or brand-specific terms)
  return word;
}

/**
 * Smart translate a product name from English to Arabic or Hebrew.
 * Handles multi-word names, preserves numbers and abbreviations.
 * Example: "iPhone 17 Pro Max" → "آيفون 17 برو ماكس"
 */
export function translateProductName(nameEn: string): { name_ar: string; name_he: string } {
  if (!nameEn?.trim()) return { name_ar: "", name_he: "" };

  const words = nameEn.trim().split(/\s+/);
  const arWords: string[] = [];
  const heWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Handle compound words like "PowerBank" → split CamelCase
    if (/^[a-z]+[A-Z]/.test(word)) {
      const parts = word.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ");
      for (const part of parts) {
        arWords.push(translateWord(part, "ar"));
        heWords.push(translateWord(part, "he"));
      }
      continue;
    }

    arWords.push(translateWord(word, "ar"));
    heWords.push(translateWord(word, "he"));
  }

  return {
    name_ar: arWords.join(" "),
    name_he: heWords.join(" "),
  };
}

/**
 * Generate marketing descriptions from specs + product info.
 * Template-based — produces natural Arabic and Hebrew descriptions.
 */
export function generateDescription(
  specs: Record<string, string>,
  nameAr: string,
  nameHe: string,
  brand: string,
): { description_ar: string; description_he: string } {
  const partsAr: string[] = [];
  const partsHe: string[] = [];

  // Opening line with product name
  partsAr.push(`${nameAr || brand} — تصميم أنيق وأداء مذهل!`);
  partsHe.push(`${nameHe || brand} — עיצוב אלגנטי וביצועים מרשימים!`);

  // Screen
  if (specs.screen) {
    const sizeMatch = specs.screen.match(/([\d.]+)\s*inches?/i);
    const typeMatch = specs.screen.match(/(OLED|AMOLED|Super Retina|LTPO|LCD|IPS|Dynamic AMOLED)/i);
    if (sizeMatch) {
      partsAr.push(`شاشة ${sizeMatch[1]} بوصة${typeMatch ? ` ${typeMatch[1]}` : ""} بجودة خارقة`);
      partsHe.push(`מסך ${sizeMatch[1]} אינץ'${typeMatch ? ` ${typeMatch[1]}` : ""} באיכות מדהימה`);
    }
  }

  // Camera
  if (specs.camera) {
    const mpMatch = specs.camera.match(/([\d.]+)\s*MP/i);
    if (mpMatch) {
      const frontMp = specs.front_camera?.match(/([\d.]+)\s*MP/i);
      const frontPart = frontMp ? ` وأمامية ${frontMp[1]}MP` : "";
      const frontPartHe = frontMp ? ` וקדמית ${frontMp[1]}MP` : "";
      partsAr.push(`كاميرا مذهلة ${mpMatch[1]}MP${frontPart}`);
      partsHe.push(`מצלמה מרשימה ${mpMatch[1]}MP${frontPartHe}`);
    }
  }

  // CPU
  if (specs.cpu) {
    const cpuShort = specs.cpu.split("(")[0].trim();
    if (cpuShort.length < 60) {
      partsAr.push(`معالج ${cpuShort} القوي`);
      partsHe.push(`מעבד ${cpuShort} עוצמתי`);
    }
  }

  // RAM
  if (specs.ram) {
    partsAr.push(`ذاكرة ${specs.ram}`);
    partsHe.push(`זיכרון ${specs.ram}`);
  }

  // Battery + Charging combined
  if (specs.battery) {
    const batMatch = specs.battery.match(/([\d,]+)\s*mAh/i);
    if (batMatch) {
      const wattMatch = specs.charging?.match(/(\d+)\s*W/i);
      const chargePart = wattMatch ? ` مع شحن سريع ${wattMatch[1]}W` : "";
      const chargePartHe = wattMatch ? ` עם טעינה מהירה ${wattMatch[1]}W` : "";
      partsAr.push(`بطارية ${batMatch[1]} mAh تدوم طول اليوم${chargePart}`);
      partsHe.push(`סוללה ${batMatch[1]} mAh שמחזיקה כל היום${chargePartHe}`);
    }
  } else if (specs.charging) {
    const wattMatch = specs.charging.match(/(\d+)\s*W/i);
    if (wattMatch) {
      partsAr.push(`شحن سريع ${wattMatch[1]}W`);
      partsHe.push(`טעינה מהירה ${wattMatch[1]}W`);
    }
  }

  // Water resistance
  if (specs.waterproof) {
    partsAr.push(`مقاومة الماء ${specs.waterproof}`);
    partsHe.push(`עמידות במים ${specs.waterproof}`);
  }

  // NFC
  if (specs.nfc && !/no/i.test(specs.nfc)) {
    partsAr.push("يدعم NFC");
    partsHe.push("תומך NFC");
  }

  // Build final description as flowing text
  if (partsAr.length <= 2) {
    // Not enough specs — simple description
    return {
      description_ar: partsAr.join(" "),
      description_he: partsHe.join(" "),
    };
  }

  // First part is the intro, rest are specs joined naturally
  const introAr = partsAr[0];
  const introHe = partsHe[0];
  const specsAr = partsAr.slice(1).join("، ");
  const specsHe = partsHe.slice(1).join(", ");

  return {
    description_ar: `${introAr} ${specsAr}.`,
    description_he: `${introHe} ${specsHe}.`,
  };
}

/**
 * Generate a URL-safe slug from English product name + brand.
 * Example: "iPhone 17 Pro Max", "Apple" → "apple-iphone-17-pro-max"
 */
export function generateSlug(nameEn: string, brand: string): string {
  const raw = `${brand} ${nameEn}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return raw;
}

/**
 * Auto-detect product type based on name and brand.
 * Returns "device" or "accessory".
 */
export function detectProductType(nameEn: string): "device" | "accessory" {
  const lower = nameEn.toLowerCase();

  // Accessory keywords
  const accessoryKeywords = [
    "case", "cover", "charger", "cable", "adapter", "protector", "glass",
    "earbuds", "headphones", "earphones", "speaker", "powerbank", "power bank",
    "stand", "holder", "strap", "band", "mount", "dock", "hub", "stylus",
    "pen", "keyboard", "mouse", "pad", "ring", "grip", "wallet", "sleeve",
    "screen protector", "tempered", "magsafe", "usb-c", "lightning",
    "airpods", "buds", "watch band", "watch strap",
  ];

  for (const kw of accessoryKeywords) {
    if (lower.includes(kw)) return "accessory";
  }

  return "device";
}

/**
 * Find potential duplicate products by checking name similarity.
 * Returns matching products with match confidence.
 */
export function findDuplicates(
  nameEn: string,
  brand: string,
  existingProducts: Product[],
  editId?: string | null,
): { product: Product; confidence: "exact" | "similar" }[] {
  if (!nameEn?.trim()) return [];

  const matches: { product: Product; confidence: "exact" | "similar" }[] = [];
  const nameNorm = nameEn.trim().toLowerCase().replace(/\s+/g, " ");
  const translated = translateProductName(nameEn);

  for (const p of existingProducts) {
    // Skip the product being edited
    if (editId && p.id === editId) continue;
    // Skip different brands
    if (brand && p.brand.toLowerCase() !== brand.toLowerCase()) continue;

    const pNameArNorm = p.name_ar.toLowerCase().replace(/\s+/g, " ");
    const pNameHeNorm = (p.name_he || "").toLowerCase().replace(/\s+/g, " ");
    const translatedArNorm = translated.name_ar.toLowerCase().replace(/\s+/g, " ");
    const translatedHeNorm = translated.name_he.toLowerCase().replace(/\s+/g, " ");

    // Exact match
    if (pNameArNorm === translatedArNorm || pNameArNorm === nameNorm || pNameHeNorm === translatedHeNorm) {
      matches.push({ product: p, confidence: "exact" });
      continue;
    }

    // Similar match — extract key identifiers (numbers + model words)
    const nameTokens = nameNorm.split(" ").filter((w) => /\d/.test(w) || w.length > 2);
    const pTokens = pNameArNorm.split(" ");
    const matchCount = nameTokens.filter((t) => pTokens.some((pt) => pt.includes(t) || t.includes(pt))).length;

    if (nameTokens.length > 0 && matchCount >= nameTokens.length * 0.7) {
      matches.push({ product: p, confidence: "similar" });
    }
  }

  return matches;
}

/**
 * All-in-one AI enhance: translate + describe + classify + SEO + duplicate check
 */
export function aiEnhanceProduct(
  nameEn: string,
  brand: string,
  specs: Record<string, string>,
  products: Product[],
  editId?: string | null,
) {
  // 1. Translate name
  const { name_ar, name_he } = translateProductName(nameEn);

  // 2. Generate descriptions
  const { description_ar, description_he } = generateDescription(specs, name_ar, name_he, brand);

  // 3. Auto-classify type
  const type = detectProductType(nameEn);

  // 4. Generate SEO slug
  const slug = generateSlug(nameEn, brand);

  // 5. Check duplicates
  const duplicates = findDuplicates(nameEn, brand, products, editId);

  return {
    name_ar,
    name_he,
    description_ar,
    description_he,
    type,
    slug,
    duplicates,
  };
}
