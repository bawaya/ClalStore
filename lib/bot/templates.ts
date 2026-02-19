// =====================================================
// ClalMobile — Bot Templates (DB-backed)
// Load message templates from bot_templates table
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

const db = () => createAdminSupabase();

// ===== Hardcoded fallbacks =====
const DEFAULT_TEMPLATES: Record<string, { ar: string; he: string }> = {
  welcome: {
    ar: "أهلاً بك في ClalMobile — وكيل رسمي لـ HOT Mobile! 📱\nاحكيلي شو الجهاز اللي بدك إياه أو ميزانيتك، وبعطيك أفضل 3 خيارات مع روابط شراء مباشرة.",
    he: "ברוכים הבאים ל-ClalMobile — סוכן רשמי של HOT Mobile! 📱\nספרו לי מה המכשיר שאתם מחפשים.",
  },
  welcome_returning: {
    ar: "أهلاً {name}! رجعت لنا 😊\nشو بقدر أساعدك اليوم؟",
    he: "שלום {name}! חזרת אלינו 😊\nאיך אפשר לעזור?",
  },
  handoff: {
    ar: "أكيد! عشان موظف يتابع معك بسرعة:\n📞 اتصل مباشرة: 053-3337653\n💬 واتساب: https://wa.me/972533337653\n📝 او عبّي الفورم: https://clalmobile.com/contact\nسجّلت طلبك وبيتواصلوا معك بأقرب وقت 🙏",
    he: "בטח! כדי שנציג ימשיך איתך:\n📞 התקשר: 053-3337653\n💬 וואטסאפ: https://wa.me/972533337653\n📝 מלא את הטופס: https://clalmobile.com/contact\nרשמנו את הבקשה 🙏",
  },
  upsell: {
    ar: "👍 اختيار ممتاز! لا تنسى الإكسسوارات:\n🛡️ جراب حماية — من 49₪\n📱 حماية شاشة — من 29₪\n🔌 شاحن أصلي — من 89₪\nتقدر تضيفهم للسلة من المتجر!",
    he: "👍 בחירה מצוינת! אל תשכחו אביזרים:\n🛡️ כיסוי מגן — מ-49₪\n📱 מגן מסך — מ-29₪\n🔌 מטען מקורי — מ-89₪",
  },
  not_available: {
    ar: "للأسف هذا المنتج غير متوفر حالياً 😞\nبس عندنا بدائل ممتازة! تبي أعرضلك؟",
    he: "מצטערים, המוצר הזה לא במלאי כרגע 😞\nיש לנו חלופות מצוינות!",
  },
  csat: {
    ar: "هل ساعدتك اليوم؟\n👍 نعم\n👎 لا",
    he: "האם עזרתי לך היום?\n👍 כן\n👎 לא",
  },
  goodbye: {
    ar: "شكراً لزيارتك ClalMobile! 🙏\nإذا احتجت أي شي، أنا هون. يوم سعيد! ✨",
    he: "תודה שביקרת ב-ClalMobile! 🙏\nאם תצטרך משהו, אני כאן. יום טוב! ✨",
  },
  out_of_hours: {
    ar: "شكراً لتواصلك! 🕐\nدوامنا أحد-خميس 9:00-18:00.\nبنرد عليك أول ما نفتح.\nأو تقدر تتصفح المتجر: clalmobile.com/store",
    he: "תודה שפנית! 🕐\nשעות העבודה שלנו ראשון-חמישי 9:00-18:00.\nאו שתגלוש בחנות: clalmobile.com/store",
  },
  rate_limited: {
    ar: "لحظة من فضلك! أنت ترسل رسائل بسرعة 😅\nجرب مرة ثانية بعد دقيقة.",
    he: "רגע בבקשה! אתה שולח הודעות מהר מדי 😅\nנסה שוב עוד דקה.",
  },
  unknown: {
    ar: "عذراً ما فهمت 🤔\n\nجرب واحد من هذي:\n📱 المنتجات\n📡 الباقات\n📦 حالة طلبي (+ رقم الطلب)\n👤 كلم موظف",
    he: "מצטער, לא הבנתי 🤔\n\nנסה:\n📱 מוצרים\n📡 חבילות\n📦 מעקב הזמנה\n👤 נציג",
  },
};

// ===== In-memory cache =====
let templateCache: Record<string, { ar: string; he: string }> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ===== Load templates from DB =====
export async function loadTemplates(): Promise<Record<string, { ar: string; he: string }>> {
  const now = Date.now();
  if (templateCache && now - cacheTime < CACHE_TTL) return templateCache;

  try {
    const { data } = await db()
      .from("bot_templates")
      .select("key, content_ar, content_he")
      .eq("active", true);

    const templates = { ...DEFAULT_TEMPLATES };
    if (data) {
      for (const row of data) {
        templates[row.key] = {
          ar: row.content_ar,
          he: row.content_he || row.content_ar,
        };
      }
    }

    templateCache = templates;
    cacheTime = now;
    return templates;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

// ===== Get single template =====
export async function getTemplate(key: string, lang: "ar" | "he" | "en", vars?: Record<string, string>): Promise<string> {
  const templates = await loadTemplates();
  const t = templates[key];
  if (!t) return DEFAULT_TEMPLATES.unknown?.[lang === "he" ? "he" : "ar"] || "";

  let text = lang === "he" ? t.he : t.ar;

  // Replace variables
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }

  return text;
}

// ===== Invalidate cache =====
export function invalidateTemplateCache(): void {
  templateCache = null;
  cacheTime = 0;
}
