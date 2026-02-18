// =====================================================
// ClalMobile — Bot Guardrails
// Rate limiting + security + PII protection
// =====================================================

// ===== Rate Limiting (in-memory) =====
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const sessionCountMap = new Map<string, number>();

const MAX_MESSAGES_PER_MINUTE = 10;
const MAX_MESSAGES_PER_SESSION = 100;
const ESCALATION_THRESHOLD = 15; // messages without resolution

export function checkRateLimit(visitorId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const minute = rateLimitMap.get(visitorId);

  if (minute) {
    if (now < minute.resetAt) {
      if (minute.count >= MAX_MESSAGES_PER_MINUTE) {
        return { allowed: false, reason: "rate_limit" };
      }
      minute.count++;
    } else {
      rateLimitMap.set(visitorId, { count: 1, resetAt: now + 60000 });
    }
  } else {
    rateLimitMap.set(visitorId, { count: 1, resetAt: now + 60000 });
  }

  // Session limit
  const sessionCount = (sessionCountMap.get(visitorId) || 0) + 1;
  sessionCountMap.set(visitorId, sessionCount);

  if (sessionCount > MAX_MESSAGES_PER_SESSION) {
    return { allowed: false, reason: "session_limit" };
  }

  return { allowed: true };
}

export function getMessageCount(visitorId: string): number {
  return sessionCountMap.get(visitorId) || 0;
}

export function shouldEscalate(messageCount: number): boolean {
  return messageCount >= ESCALATION_THRESHOLD;
}

export function resetSessionCount(visitorId: string): void {
  sessionCountMap.delete(visitorId);
  rateLimitMap.delete(visitorId);
}

// ===== Blocked Patterns =====
const BLOCKED_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /سعر.*(جملة|تكلفة|كوست|cost)/i, category: "wholesale_price" },
  { pattern: /هامش|ربح|margin|profit/i, category: "profit_margin" },
  { pattern: /admin|ادمن|password|كلمة.*سر|סיסמה/i, category: "admin_access" },
  { pattern: /بيانات.*عميل.*اخر|معلومات.*شخص|נתונים.*לקוח/i, category: "other_customer_data" },
  { pattern: /hack|inject|script|<script|eval\(/i, category: "injection" },
  { pattern: /sql.*inject|union\s+select|drop\s+table/i, category: "sql_injection" },
];

export function checkBlockedPatterns(message: string): { blocked: boolean; category?: string } {
  for (const { pattern, category } of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return { blocked: true, category };
    }
  }
  return { blocked: false };
}

export function getBlockedResponse(category: string, lang: "ar" | "he" | "en"): string {
  const responses: Record<string, Record<string, string>> = {
    wholesale_price: {
      ar: "عذراً، الأسعار الموجودة بالمتجر هي أسعار نهائية شاملة الضريبة 😊\nتفضل زر المتجر: clalmobile.com/store",
      he: "מצטערים, המחירים באתר הם מחירים סופיים כולל מע\"מ 😊",
      en: "Sorry, prices shown in the store are final prices including tax 😊",
    },
    profit_margin: {
      ar: "هذي معلومات داخلية عذراً 😅\nبقدر أساعدك تلاقي أفضل صفقة بالمتجر!",
      he: "מידע פנימי, מצטערים 😅",
      en: "That's internal information, sorry 😅",
    },
    admin_access: {
      ar: "ما عندي صلاحية لهذي المعلومات 🔒\nكيف أقدر أساعدك بشي ثاني؟",
      he: "אין לי גישה למידע הזה 🔒",
      en: "I don't have access to this information 🔒",
    },
    other_customer_data: {
      ar: "عذراً، بيانات العملاء سرية ومحمية 🔐\nأقدر أساعدك بمعلوماتك الشخصية فقط.",
      he: "מצטערים, נתוני לקוחות מוגנים 🔐",
      en: "Sorry, customer data is protected 🔐",
    },
    injection: {
      ar: "عذراً ما فهمت 🤔 أقدر أساعدك بالمنتجات أو الطلبات.",
      he: "מצטערים, לא הבנתי 🤔",
      en: "Sorry, I didn't understand 🤔",
    },
    sql_injection: {
      ar: "عذراً ما فهمت 🤔 أقدر أساعدك بالمنتجات أو الطلبات.",
      he: "מצטערים, לא הבנתי 🤔",
      en: "Sorry, I didn't understand 🤔",
    },
  };

  return responses[category]?.[lang] || responses[category]?.["ar"] || "عذراً، ما أقدر أساعدك بهذا.";
}

// ===== PII Masking =====
export function maskPhone(phone: string): string {
  if (phone.length < 7) return "***";
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

export function maskIdNumber(id: string): string {
  if (id.length < 5) return "***";
  return id.slice(0, 2) + "*".repeat(id.length - 4) + id.slice(-2);
}

// ===== Sanitize user input =====
export function sanitizeInput(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")          // remove HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // remove control chars
    .trim()
    .slice(0, 1000);                   // max 1000 chars
}

// ===== Check if within working hours =====
export function isWithinWorkingHours(): boolean {
  const now = new Date();
  // Israel timezone (UTC+2 / UTC+3 DST)
  const israelTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const day = israelTime.getDay(); // 0=Sun, 6=Sat
  const hour = israelTime.getHours();

  // Sunday(0)-Thursday(4): 9:00-18:00
  if (day >= 0 && day <= 4 && hour >= 9 && hour < 18) return true;
  return false;
}
