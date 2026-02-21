// =====================================================
// ClalMobile — Bot Engine (Season 5)
// State machine + intent → response + DB queries
// Unified across WebChat + WhatsApp
// =====================================================

import { detectIntent as detectIntentRaw, type DetectedIntent, type BotIntent } from "./intents";
import { getTemplate } from "./templates";
import { getPolicy, detectPolicyType, formatPolicyResponse } from "./policies";
import {
  searchProducts, searchByModel, recommendProducts, lookupOrder,
  formatProductCards, calculateInstallments, formatComparison,
  getLinePlans, formatLinePlans, upsertCustomer,
  type QualificationState, getNextQualificationQuestion, parseQualificationAnswer,
} from "./playbook";
import {
  checkRateLimit, checkBlockedPatterns, getBlockedResponse,
  sanitizeInput, shouldEscalate, getMessageCount, isWithinWorkingHours,
} from "./guardrails";
import {
  getOrCreateConversation, saveMessage, closeConversation,
  saveCsatScore, addProductDiscussed, linkCustomer,
  trackAnalytics, logBotInteraction,
} from "./analytics";
import { createHandoff, generateConversationSummary } from "./handoff";
import { createAdminSupabase } from "@/lib/supabase";
import { getAIResponse } from "./ai";
import { notifyAdminMuhammadHandoff } from "./admin-notify";

export { type BotIntent, type DetectedIntent } from "./intents";
export { logBotInteraction } from "./analytics";

const BASE_URL = "https://clalmobile.com";

// ===== Bot Response =====
export interface BotResponse {
  text: string;
  quickReplies?: string[];
  escalate?: boolean;
  image?: string;
  conversationId?: string;
}

// ===== Session State (in-memory cache + DB persistence) =====
interface SessionState {
  conversationId: string;
  visitorId: string;
  language: "ar" | "he" | "en";
  qualification: QualificationState;
  qualifyingIntent?: BotIntent;  // the intent that triggered qualification
  messageCount: number;
  lastIntent?: BotIntent;
  lastProductIds: string[];
  customerPhone?: string;
  customerName?: string;
  customerId?: string;
  csatAsked: boolean;
  // Muhammad handoff flow
  muhammadStep?: number; // 0=not active, 1=ask name, 2=ask phone, 3=ask message
  muhammadData?: { name?: string; phone?: string; message?: string };
  // Greeting variation counter
  greetingCount?: number;
}

// In-memory cache (fast, per-instance). DB is source of truth.
const sessionCache = new Map<string, SessionState>();

async function getSession(visitorId: string, channel: "webchat" | "whatsapp"): Promise<SessionState | undefined> {
  // 1. Check in-memory cache first
  const cached = sessionCache.get(visitorId);
  if (cached) return cached;

  // 2. Look for active conversation in DB
  try {
    const s = createAdminSupabase();
    const { data } = await s
      .from("bot_conversations")
      .select("*")
      .eq("visitor_id", visitorId)
      .eq("channel", channel)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const qual = (data.qualification as any) || {};
      const session: SessionState = {
        conversationId: data.id,
        visitorId,
        language: (data.language as "ar" | "he" | "en") || "ar",
        qualification: { step: qual.step || 0, answers: qual.answers } as QualificationState,
        messageCount: data.message_count || 0,
        lastProductIds: (data.products_discussed as string[]) || [],
        customerPhone: data.customer_phone || undefined,
        customerName: data.customer_name || undefined,
        customerId: data.customer_id || undefined,
        csatAsked: !!data.csat_score,
        // Restore Muhammad handoff state from qualification JSONB
        muhammadStep: qual._muhammadStep || 0,
        muhammadData: qual._muhammadData || undefined,
        greetingCount: qual._greetingCount || 0,
      };
      sessionCache.set(visitorId, session);
      return session;
    }
  } catch {
    // No active conversation found
  }

  return undefined;
}

async function setSession(state: SessionState): Promise<void> {
  sessionCache.set(state.visitorId, state);
  // Persist session state to DB — include Muhammad handoff + greeting count in qualification JSONB
  try {
    const s = createAdminSupabase();
    const qualData = {
      ...state.qualification,
      _muhammadStep: state.muhammadStep || 0,
      _muhammadData: state.muhammadData || null,
      _greetingCount: state.greetingCount || 0,
    };
    await s
      .from("bot_conversations")
      .update({
        language: state.language,
        qualification: qualData as any,
        message_count: state.messageCount,
        products_discussed: state.lastProductIds,
        customer_phone: state.customerPhone || null,
        customer_name: state.customerName || null,
        customer_id: state.customerId || null,
      } as any)
      .eq("id", state.conversationId);
  } catch (err) {
    console.error("Session persist error:", err);
  }
}

// ===== ORDER STATUS LABELS =====
const ORDER_STATUS_AR: Record<string, string> = {
  new: "جديد 📋",
  approved: "تمت الموافقة ✅",
  rejected: "مرفوض ❌",
  processing: "قيد التجهيز 📦",
  shipped: "تم الشحن 🚚",
  delivered: "تم التسليم ✅",
  cancelled: "ملغي ❌",
  no_response: "لا يوجد رد 📞",
  no_reply_1: "📞 حاولنا نتواصل — رد علينا!",
  no_reply_2: "📞📞 المحاولة الثانية",
  no_reply_3: "⚠️ المحاولة الأخيرة",
};

const ORDER_STATUS_HE: Record<string, string> = {
  new: "חדש 📋",
  approved: "מאושר ✅",
  rejected: "נדחה ❌",
  processing: "בהכנה 📦",
  shipped: "נשלח 🚚",
  delivered: "נמסר ✅",
  cancelled: "בוטל ❌",
};

// ===== MAIN PROCESS MESSAGE =====
export async function processMessage(
  visitorId: string,
  message: string,
  channel: "webchat" | "whatsapp",
  opts?: { customerPhone?: string; customerName?: string; source?: string }
): Promise<BotResponse> {
  // 1. Sanitize
  const text = sanitizeInput(message);
  if (!text) return { text: "أرسل رسالة وأقدر أساعدك! 😊" };

  // 2. Rate limit
  const rateCheck = checkRateLimit(visitorId);
  if (!rateCheck.allowed) {
    const lang = sessionCache.get(visitorId)?.language || "ar";
    return { text: await getTemplate("rate_limited", lang) };
  }

  // 3. Blocked patterns
  const blockCheck = checkBlockedPatterns(text);
  if (blockCheck.blocked) {
    const lang = sessionCache.get(visitorId)?.language || "ar";
    return { text: getBlockedResponse(blockCheck.category!, lang) };
  }

  // 4. Detect intent
  const detected = detectIntentRaw(text);
  const lang = detected.language;

  // 5. Get or create session
  let session = await getSession(visitorId, channel);
  if (!session) {
    const convId = await getOrCreateConversation(visitorId, channel, {
      language: lang,
      source: opts?.source,
    });
    session = {
      conversationId: convId,
      visitorId,
      language: lang,
      qualification: { step: 0 },
      messageCount: 0,
      lastProductIds: [],
      customerPhone: opts?.customerPhone,
      customerName: opts?.customerName,
      csatAsked: false,
    };
    await setSession(session);
    await trackAnalytics(channel, { newConversation: true });
  }

  session.messageCount++;
  session.language = lang;
  if (opts?.customerPhone) session.customerPhone = opts.customerPhone;
  if (opts?.customerName) session.customerName = opts.customerName;

  // Save user message
  await saveMessage(session.conversationId, "user", text, detected.intent, detected.confidence);
  await trackAnalytics(channel, { newMessage: true, intent: detected.intent });

  // 6. Check escalation threshold
  if (shouldEscalate(session.messageCount) && !session.csatAsked) {
    const response = await handleEscalation(session, "message_limit", lang);
    await saveMessage(session.conversationId, "bot", response.text);
    await setSession(session);
    return { ...response, conversationId: session.conversationId };
  }

  // 7. Check if user is in Muhammad handoff data collection
  if (session.muhammadStep && session.muhammadStep > 0 && session.muhammadStep <= 3) {
    const response = await handleMuhammadCollect(session, text, channel);
    await saveMessage(session.conversationId, "bot", response.text, "muhammad_request");
    await setSession(session);
    return { ...response, conversationId: session.conversationId };
  }

  // 8. Check if user is answering a qualification question
  // BUT: if the user explicitly asks for human/complaint/tracking/contact — break out of qualification
  if (session.qualification.step > 0 && session.qualification.step < 5) {
    const escapeIntents: BotIntent[] = ["human_request", "muhammad_request", "complaint", "greeting", "order_tracking", "contact_info", "thanks"];
    if (escapeIntents.includes(detected.intent)) {
      // User wants to leave qualification — reset and route normally
      session.qualification = { step: 0 };
      session.qualifyingIntent = undefined;
    } else {
      const response = await handleQualificationAnswer(session, text, detected, channel);
      await saveMessage(session.conversationId, "bot", response.text, detected.intent);
      await setSession(session);
      return { ...response, conversationId: session.conversationId };
    }
  }

  // 8. Route by intent
  const response = await routeIntent(session, detected, text, channel);

  // Save bot response
  await saveMessage(session.conversationId, "bot", response.text, detected.intent);
  session.lastIntent = detected.intent;
  await setSession(session);

  return { ...response, conversationId: session.conversationId };
}

// ===== Intent Router =====
async function routeIntent(
  session: SessionState,
  detected: DetectedIntent,
  text: string,
  channel: "webchat" | "whatsapp"
): Promise<BotResponse> {
  const lang = session.language;
  const isAr = lang !== "he";

  // For very low confidence keyword matches, prefer AI
  if (detected.intent !== "unknown" && detected.confidence < 0.5) {
    const aiResponse = await getAIResponse(
      session.conversationId,
      text,
      {
        customerName: session.customerName,
        lastProducts: session.lastProductIds,
        language: session.language,
      }
    );
    if (aiResponse) return aiResponse;
    // If AI fails, continue with keyword-based handler
  }

  switch (detected.intent) {
    case "greeting":
      return handleGreeting(session);

    case "buy_now":
      return handleBuyNow(session, detected, channel);

    case "price_inquiry":
      return handlePriceInquiry(session, detected);

    case "compare":
      return handleCompare(session, detected);

    case "installment_info":
      return handleInstallments(session, detected);

    case "specs_inquiry":
      return handleSpecs(session, detected);

    case "availability":
      return handleAvailability(session, detected);

    case "shipping_info":
      return handlePolicy(session, "shipping");

    case "warranty_return":
      return handlePolicy(session, detectPolicyType(text) || "warranty");

    case "order_tracking":
      return handleOrderTracking(session, detected);

    case "line_plans":
      return handleLinePlans(session);

    case "complaint":
      return handleEscalation(session, "complaint", lang);

    case "human_request":
      return handleEscalation(session, "human_request", lang);

    case "muhammad_request":
      return handleMuhammadRequest(session);

    case "contact_info":
      return handleContactInfo(session);

    case "csat_response":
      return handleCsatResponse(session, detected);

    case "thanks":
      return handleThanks(session);

    default:
      return handleUnknown(session, text);
  }
}

// ===== INTENT HANDLERS =====

async function handleGreeting(session: SessionState): Promise<BotResponse> {
  const lang = session.language;
  const isAr = lang !== "he";
  const quickReplies = isAr
    ? ["📱 المنتجات", "📡 الباقات", "📦 حالة طلبي", "👤 كلم موظف"]
    : ["📱 מוצרים", "📡 חבילות", "📦 מעקב הזמנה", "👤 נציג"];

  // Track greeting count for variation
  session.greetingCount = (session.greetingCount || 0) + 1;
  const gc = session.greetingCount;

  if (session.customerName) {
    // First greeting — warm welcome
    if (gc <= 1) {
      const text = await getTemplate("welcome_returning", lang, { name: session.customerName });
      return { text, quickReplies };
    }

    // Varied responses for repeated greetings
    const arVariations = [
      `هلا ${session.customerName}! 👋 كيف بقدر أساعدك؟`,
      `أهلين ${session.customerName}! شو بتحتاج اليوم؟ 😊`,
      `مرحبا ${session.customerName}! عندك سؤال أو بتدور على منتج معين؟ 📱`,
      `هلا بيك ${session.customerName}! 🙌 احكيلي شو بدك وبساعدك فوراً`,
      `تنورنا ${session.customerName}! 😊 بخدمتك — اختار من القائمة أو اسأل سؤالك`,
    ];
    const heVariations = [
      `היי ${session.customerName}! 👋 איך אפשר לעזור?`,
      `שלום ${session.customerName}! מה תרצה היום? 😊`,
      `הי ${session.customerName}! מחפש מוצר מסוים? 📱`,
      `${session.customerName}, אני כאן! 🙌 מה אפשר לעשות בשבילך?`,
      `ברוך הבא ${session.customerName}! 😊 בחר מהתפריט או שאל שאלה`,
    ];
    const variations = isAr ? arVariations : heVariations;
    const idx = (gc - 2) % variations.length;
    return { text: variations[idx], quickReplies };
  }

  const text = await getTemplate("welcome", lang);
  return { text, quickReplies };
}

async function handleBuyNow(
  session: SessionState,
  detected: DetectedIntent,
  channel: "webchat" | "whatsapp"
): Promise<BotResponse> {
  const { model, brand, storage } = detected.params as Record<string, string | undefined>;
  const isAr = session.language !== "he";

  // If specific model mentioned → search directly
  if (model) {
    const products = await searchByModel(model, storage);
    if (products.length === 0) {
      const text = await getTemplate("not_available", session.language);
      return {
        text,
        quickReplies: isAr ? ["📱 منتجات ثانية", "💰 عندي ميزانية", "👤 كلم موظف"] : ["📱 מוצרים", "💰 תקציב", "👤 נציג"],
      };
    }

    // Track products discussed
    for (const p of products) {
      await addProductDiscussed(session.conversationId, p.id);
      await trackAnalytics(channel, { storeClick: true, productId: p.id });
    }

    session.lastProductIds = products.map(p => p.id);
    const cards = formatProductCards(products.slice(0, 3), BASE_URL);
    const header = isAr
      ? `وجدت لك ${Math.min(products.length, 3)} خيارات ممتازة:`
      : `מצאתי ${Math.min(products.length, 3)} אפשרויות מעולות:`;
    const cta = isAr ? "جاهز تشتري؟ اضغط على الرابط وأكمل الطلب! 🛒" : "מוכן לרכוש? לחץ על הקישור! 🛒";

    return {
      text: `${header}\n\n${cards}\n\n${cta}`,
      quickReplies: isAr
        ? ["💰 كم القسط؟", "📱 منتجات ثانية", "👤 كلم موظف"]
        : ["💰 כמה התשלום?", "📱 מוצרים נוספים", "👤 נציג"],
    };
  }

  // If brand only → search by brand
  if (brand) {
    const products = await searchProducts({ brand, limit: 3, inStockOnly: true });
    if (products.length === 0) {
      return {
        text: isAr
          ? `ما لقيت أجهزة ${brand} متوفرة حالياً. تبي أشوفلك ماركة ثانية؟`
          : `לא מצאתי מכשירי ${brand} זמינים כרגע.`,
        quickReplies: isAr ? ["Samsung", "Apple", "Xiaomi", "💰 عندي ميزانية"] : ["Samsung", "Apple", "Xiaomi"],
      };
    }

    session.lastProductIds = products.map(p => p.id);
    const cards = formatProductCards(products, BASE_URL);
    return {
      text: isAr
        ? `📱 *أفضل أجهزة ${brand}:*\n\n${cards}\n\nبدك أساعدك تختار؟ احكيلي ميزانيتك!`
        : `📱 *מכשירי ${brand} מובילים:*\n\n${cards}`,
      quickReplies: isAr ? ["💰 عندي ميزانية", "📱 منتجات ثانية", "👤 كلم موظف"] : ["💰 תקציב", "📱 עוד", "👤 נציג"],
    };
  }

  // No specific product → start qualification
  session.qualification = { step: 1 };
  session.qualifyingIntent = "buy_now";
  const q = getNextQualificationQuestion(session.qualification, session.language);
  if (q) {
    return { text: q.question, quickReplies: q.options };
  }

  return {
    text: isAr ? "احكيلي شو المنتج اللي بدك إياه أو ميزانيتك 💰" : "ספרו לי מה המכשיר או התקציב 💰",
    quickReplies: isAr ? ["Apple", "Samsung", "Xiaomi", "💰 عندي ميزانية"] : ["Apple", "Samsung", "Xiaomi"],
  };
}

async function handleQualificationAnswer(
  session: SessionState,
  text: string,
  detected: DetectedIntent,
  channel: "webchat" | "whatsapp"
): Promise<BotResponse> {
  const isAr = session.language !== "he";

  // Map current step to field
  const fields = ["budget", "priority", "brand", "payment"];
  const fieldIndex = session.qualification.step - 1;
  const field = fields[fieldIndex];

  if (field) {
    const value = parseQualificationAnswer(field, text);
    (session.qualification as unknown as Record<string, unknown>)[field] = value;
    session.qualification.step++;
  }

  // Check if more questions needed
  const next = getNextQualificationQuestion(session.qualification, session.language);
  if (next) {
    return { text: next.question, quickReplies: next.options };
  }

  // All questions answered → recommend
  session.qualification.step = 5;
  const products = await recommendProducts(session.qualification);

  if (products.length === 0) {
    session.qualification = { step: 0 };
    return {
      text: isAr
        ? "عذراً ما لقيت أجهزة تناسب المواصفات بالضبط 😞\nبدك أبحثلك بمعايير ثانية؟"
        : "מצטער, לא מצאתי מכשירים מתאימים 😞",
      quickReplies: isAr ? ["📱 المنتجات", "💰 ميزانية ثانية", "👤 كلم موظف"] : ["📱 מוצרים", "👤 נציג"],
    };
  }

  session.lastProductIds = products.map(p => p.id);
  session.qualification = { step: 0 };

  for (const p of products) {
    await addProductDiscussed(session.conversationId, p.id);
    await trackAnalytics(channel, { storeClick: true, productId: p.id });
  }

  const cards = formatProductCards(products, BASE_URL);
  return {
    text: isAr
      ? `وجدت لك ${products.length} خيارات ممتازة:\n\n${cards}\n\nجاهز تشتري؟ اضغط على الرابط وأكمل الطلب! 🛒`
      : `מצאתי ${products.length} אפשרויות מעולות:\n\n${cards}\n\nמוכן? לחץ על הקישור! 🛒`,
    quickReplies: isAr ? ["💰 كم القسط؟", "🛡️ إكسسوارات", "👤 كلم موظف"] : ["💰 תשלומים?", "👤 נציג"],
  };
}

async function handlePriceInquiry(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const { brand } = detected.params as Record<string, string | undefined>;
  const isAr = session.language !== "he";

  if (brand) {
    const products = await searchProducts({ brand, limit: 5, inStockOnly: true });
    if (products.length === 0) {
      return { text: isAr ? `ما عندنا ${brand} حالياً. جرب ماركة ثانية!` : `אין לנו ${brand} כרגע.` };
    }
    session.lastProductIds = products.map(p => p.id);
    const cards = formatProductCards(products.slice(0, 3), BASE_URL);
    return {
      text: isAr ? `💰 *أسعار ${brand}:*\n\n${cards}` : `💰 *מחירי ${brand}:*\n\n${cards}`,
      quickReplies: isAr ? ["💰 كم القسط؟", "📱 ماركة ثانية", "👤 كلم موظف"] : ["💰 תשלומים?", "📱 עוד", "👤 נציג"],
    };
  }

  // No brand → ask
  return {
    text: isAr ? "أي ماركة بالضبط؟ 📱" : "איזה מותג? 📱",
    quickReplies: ["Apple", "Samsung", "Xiaomi", "Oppo", "Google"],
  };
}

async function handleCompare(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const isAr = session.language !== "he";
  const brands = (String(detected.params.brands || "")).split(",").filter(Boolean);

  if (brands.length >= 2) {
    const [prodA] = await searchProducts({ brand: brands[0], limit: 1 });
    const [prodB] = await searchProducts({ brand: brands[1], limit: 1 });

    if (prodA && prodB) {
      const comparison = formatComparison(prodA, prodB, BASE_URL);
      return {
        text: comparison,
        quickReplies: isAr ? ["🛒 أبغى أطلب", "💰 كم القسط؟", "👤 كلم موظف"] : ["🛒 לרכוש", "👤 נציג"],
      };
    }
  }

  return {
    text: isAr ? "أي جهازين بدك أقارن بينهم؟ مثلاً:\n\"الفرق بين آيفون 16 و S25\"" : 'אילו שני מכשירים להשוות? לדוגמה:\n"ההבדל בין אייפון 16 ל-S25"',
    quickReplies: isAr ? ["آيفون 16 ولا S25", "آيفون 17 ولا S25 Ultra"] : ["אייפון 16 או S25"],
  };
}

async function handleInstallments(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const isAr = session.language !== "he";

  // If we have last discussed products
  if (session.lastProductIds.length > 0) {
    const { createAdminSupabase } = await import("@/lib/supabase");
    const { data } = await createAdminSupabase()
      .from("products").select("*").in("id", session.lastProductIds).limit(1);

    if (data && data.length > 0) {
      const p = data[0];
      const inst = calculateInstallments(Number(p.price));
      return {
        text: isAr
          ? `💰 تقسيط بدون فوائد!\n${p.name_ar} — ${Number(p.price).toLocaleString()}₪\n\nاختر عدد الدفعات (تحويل بنكي):\n1 دفعة = ${Number(p.price).toLocaleString()}₪\n3 دفعات = ${inst.m3.toLocaleString()}₪/شهر\n6 دفعات = ${inst.m6.toLocaleString()}₪/شهر\n12 دفعة = ${inst.m12.toLocaleString()}₪/شهر\n18 دفعة = ${inst.m18.toLocaleString()}₪/شهر\n\nبدون فوائد! عبر حوالة بنكية 🏦`
          : `💰 תשלומים במחיר המזומן!\n${p.name_ar} — ${Number(p.price).toLocaleString()}₪\n\n3 תשלומים = ${inst.m3.toLocaleString()}₪\n6 תשלומים = ${inst.m6.toLocaleString()}₪\n12 תשלומים = ${inst.m12.toLocaleString()}₪\n18 תשלומים = ${inst.m18.toLocaleString()}₪`,
        quickReplies: isAr ? ["🛒 أطلب الآن", "📱 منتجات ثانية", "👤 كلم موظف"] : ["🛒 לרכוש", "👤 נציג"],
      };
    }
  }

  // General installment policy
  const policy = await getPolicy("installments");
  if (policy) {
    return {
      text: formatPolicyResponse(policy, session.language),
      quickReplies: isAr ? ["📱 المنتجات", "🛒 أبغى أطلب", "👤 كلم موظف"] : ["📱 מוצרים", "👤 נציג"],
    };
  }

  return {
    text: isAr ? "تقسيط من 1-18 دفعة بدون فوائد عبر تحويل بنكي! 🏦\nاحكيلي أي جهاز بدك وأحسبلك." : "1-18 תשלומים ללא ריבית בהעברה בנקאית! 🏦",
  };
}

async function handleSpecs(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const isAr = session.language !== "he";
  return {
    text: isAr
      ? "اكتب اسم الجهاز وأعطيك المواصفات + السعر!\nمثلاً: \"آيفون 17 برو\" أو \"S25 Ultra\""
      : "כתוב את שם המכשיר ואתן לך מפרט + מחיר!",
    quickReplies: ["iPhone 17 Pro", "Galaxy S25 Ultra", "Xiaomi 15T Pro"],
  };
}

async function handleAvailability(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const { brand } = detected.params as Record<string, string | undefined>;
  const isAr = session.language !== "he";

  if (brand) {
    const products = await searchProducts({ brand, limit: 5, inStockOnly: true });
    if (products.length === 0) {
      return { text: isAr ? `للأسف ${brand} مش متوفر حالياً 😞` : `מצטערים, ${brand} לא זמין כרגע 😞` };
    }
    const names = products.map(p => `✅ ${p.name_ar}`).join("\n");
    return {
      text: isAr ? `متوفر من ${brand}:\n${names}\n\nتبي تفاصيل أكثر؟` : `זמין מ-${brand}:\n${names}`,
      quickReplies: isAr ? ["💰 أسعار", "🛒 أبغى أطلب", "👤 كلم موظف"] : ["💰 מחירים", "🛒 לרכוש"],
    };
  }

  return {
    text: isAr ? "أي منتج بدك تعرف إذا متوفر؟ اكتب اسمه!" : "איזה מוצר לבדוק? כתוב את השם!",
    quickReplies: ["Apple", "Samsung", "Xiaomi"],
  };
}

async function handlePolicy(session: SessionState, type: string): Promise<BotResponse> {
  const isAr = session.language !== "he";
  const policy = await getPolicy(type as "warranty" | "return" | "shipping" | "installments" | "privacy");

  if (policy) {
    return {
      text: formatPolicyResponse(policy, session.language),
      quickReplies: isAr ? ["📱 المنتجات", "📦 حالة طلبي", "👤 كلم موظف"] : ["📱 מוצרים", "📦 הזמנה", "👤 נציג"],
    };
  }

  return {
    text: isAr
      ? "للمزيد عن سياساتنا: clalmobile.com/legal\nأو اكتب \"كلم موظف\" 📝"
      : "למידע נוסף: clalmobile.com/legal",
  };
}

async function handleOrderTracking(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const { orderId } = detected.params as Record<string, string | undefined>;
  const isAr = session.language !== "he";

  if (!orderId) {
    // Try looking up by phone
    if (session.customerPhone) {
      const order = await lookupOrder(undefined, session.customerPhone);
      if (order) {
        const status = isAr
          ? (ORDER_STATUS_AR[order.status] || order.status)
          : (ORDER_STATUS_HE[order.status] || order.status);
        const items = (order.order_items || []).map((i: { product_name: string }) => i.product_name).join(", ");
        return {
          text: isAr
            ? `📦 *طلبك ${order.id}:*\nالحالة: ${status}\nالمنتجات: ${items || "—"}\nالتاريخ: ${new Date(order.created_at).toLocaleDateString("ar-EG")}`
            : `📦 *הזמנה ${order.id}:*\nסטטוס: ${status}`,
          quickReplies: isAr ? ["👤 كلم موظف", "📱 المنتجات"] : ["👤 נציג", "📱 מוצרים"],
        };
      }
    }

    return {
      text: isAr ? "أرسلي رقم الطلب (مثال: CLM-00001) وأعطيك الحالة فوراً! 📦" : "שלח מספר הזמנה (לדוגמה: CLM-00001) 📦",
    };
  }

  const order = await lookupOrder(orderId);
  if (!order) {
    return {
      text: isAr
        ? `عذراً، ما لقيت طلب برقم *${orderId}*.\nتأكد من الرقم وحاول مرة ثانية.`
        : `מצטער, לא מצאתי הזמנה *${orderId}*.`,
    };
  }

  const status = isAr
    ? (ORDER_STATUS_AR[order.status] || order.status)
    : (ORDER_STATUS_HE[order.status] || order.status);
  const items = (order.order_items || []).map((i: { product_name: string }) => i.product_name).join(", ");

  return {
    text: isAr
      ? `📦 *طلب ${order.id}:*\nالحالة: ${status}\nالمنتجات: ${items || "—"}\n💰 المبلغ: ${Number(order.total).toLocaleString()}₪\n🏙️ التوصيل: ${order.shipping_city || "—"}\nالتاريخ: ${new Date(order.created_at).toLocaleDateString("ar-EG")}\n\nللاستفسار اكتب "كلم موظف"`
      : `📦 *הזמנה ${order.id}:*\nסטטוס: ${status}\nסכום: ${Number(order.total).toLocaleString()}₪`,
    quickReplies: isAr ? ["👤 كلم موظف", "📱 المنتجات", "📡 الباقات"] : ["👤 נציג", "📱 מוצרים"],
  };
}

async function handleLinePlans(session: SessionState): Promise<BotResponse> {
  const isAr = session.language !== "he";
  const plans = await getLinePlans();

  if (plans.length === 0) {
    return {
      text: isAr ? "للاطلاع على باقات HOT Mobile: clalmobile.com/store" : "חבילות HOT Mobile: clalmobile.com/store",
    };
  }

  const formatted = formatLinePlans(plans);
  return {
    text: isAr
      ? `${formatted}\n\n📞 للتفعيل تواصل معنا أو اختر "كلم موظف"`
      : `${formatted}\n\nלהפעלה צרו קשר`,
    quickReplies: isAr ? ["👤 كلم موظف", "📱 المنتجات", "📦 حالة طلبي"] : ["👤 נציג", "📱 מוצרים"],
  };
}

async function handleContactInfo(session: SessionState): Promise<BotResponse> {
  const isAr = session.language !== "he";
  return {
    text: isAr
      ? `🌐 *الموقع:* https://clalmobile.com\n📝 *فورم التواصل:* https://clalmobile.com/contact\n🚚 *توصيل مجاني* لكل أنحاء إسرائيل\n\nنحن كول سنتر — نخدمك عن بعد ونوصل لباب بيتك! 🏠\nأو راسلنا هون مباشرة وبنساعدك 💬\n\nكيف بقدر أساعدك؟`
      : `🌐 *אתר:* https://clalmobile.com\n📝 *טופס יצירת קשר:* https://clalmobile.com/contact\n🚚 *משלוח חינם* לכל הארץ\n\nאנחנו מרכז שירות — משרתים אותך מרחוק ומשלוחים עד הבית! 🏠\nאו כתבו לנו כאן ונעזור 💬\n\nאיך אפשר לעזור?`,
    quickReplies: isAr
      ? ["📱 المنتجات", "📡 الباقات", "👤 كلم موظف"]
      : ["📱 מוצרים", "📡 חבילות", "👤 נציג"],
  };
}

async function handleEscalation(session: SessionState, reason: string, lang: "ar" | "he" | "en"): Promise<BotResponse> {
  const summary = await generateConversationSummary(session.conversationId);

  await createHandoff({
    conversationId: session.conversationId,
    customerId: session.customerId,
    reason,
    summary,
    productsInterested: session.lastProductIds,
    customerPhone: session.customerPhone,
    customerName: session.customerName,
  });

  await trackAnalytics("webchat", { handoff: true });

  const text = await getTemplate("handoff", lang);
  return { text, escalate: true };
}

async function handleCsatResponse(session: SessionState, detected: DetectedIntent): Promise<BotResponse> {
  const response = detected.params.response;
  const score = response === "👍" || response === "نعم" || response === "כן" ? 5 : 2;
  await saveCsatScore(session.conversationId, score);

  const text = await getTemplate("goodbye", session.language);
  await closeConversation(session.conversationId);
  return { text };
}

async function handleThanks(session: SessionState): Promise<BotResponse> {
  const isAr = session.language !== "he";

  // Ask for CSAT if not asked yet
  if (!session.csatAsked) {
    session.csatAsked = true;
    const csat = await getTemplate("csat", session.language);
    return {
      text: isAr ? `العفو! 😊\n\n${csat}` : `בבקשה! 😊\n\n${csat}`,
      quickReplies: ["👍", "👎"],
    };
  }

  const text = await getTemplate("goodbye", session.language);
  return { text };
}

async function handleUnknown(session: SessionState, text: string): Promise<BotResponse> {
  // Try AI-powered contextual response first
  const aiResponse = await getAIResponse(
    session.conversationId,
    text,
    {
      customerName: session.customerName,
      lastProducts: session.lastProductIds,
      language: session.language,
    }
  );

  if (aiResponse) {
    return {
      text: aiResponse.text,
      quickReplies: aiResponse.quickReplies,
    };
  }

  // Fallback to template if AI is unavailable
  const templateText = await getTemplate("unknown", session.language);
  const isAr = session.language !== "he";
  return {
    text: templateText,
    quickReplies: isAr
      ? ["📱 المنتجات", "📡 الباقات", "📦 حالة طلبي", "👤 كلم موظف"]
      : ["📱 מוצרים", "📡 חבילות", "📦 הזמנה", "👤 נציג"],
  };
}

// ===== Muhammad Request Handler =====
async function handleMuhammadRequest(session: SessionState): Promise<BotResponse> {
  const isAr = session.language !== "he";
  session.muhammadStep = 1;
  session.muhammadData = {};

  return {
    text: isAr
      ? "بالتأكيد! سأوصل رسالتك لمحمد 📲\n\nأحتاج منك بعض البيانات أولاً:\n\n👤 ما هو اسمك الكامل؟"
      : "בטח! אעביר את ההודעה למוחמד 📲\n\nאני צריך כמה פרטים:\n\n👤 מה השם המלא שלך?",
  };
}

async function handleMuhammadCollect(
  session: SessionState,
  text: string,
  channel: "webchat" | "whatsapp"
): Promise<BotResponse> {
  const isAr = session.language !== "he";
  const data = session.muhammadData || {};

  switch (session.muhammadStep) {
    case 1: // Collecting name
      data.name = text.trim();
      session.muhammadData = data;
      session.muhammadStep = 2;
      return {
        text: isAr
          ? `شكراً ${data.name}! 👍\n\n📞 ما هو رقم هاتفك؟`
          : `תודה ${data.name}! 👍\n\n📞 מה מספר הטלפון שלך?`,
      };

    case 2: // Collecting phone
      data.phone = text.trim().replace(/[-\s]/g, "");
      session.muhammadData = data;
      session.muhammadStep = 3;
      return {
        text: isAr
          ? "💬 ما هو طلبك أو استفسارك لمحمد؟\n(اكتب ملخص قصير)"
          : "💬 מה ההודעה שלך למוחמד?\n(כתוב בקצרה)",
      };

    case 3: // Collecting message — DONE
      data.message = text.trim();
      session.muhammadData = data;
      session.muhammadStep = 0; // Reset

      // Send notification to admin (Muhammad)
      try {
        await notifyAdminMuhammadHandoff({
          name: data.name || "—",
          phone: data.phone || session.customerPhone || "—",
          message: data.message || "—",
          channel,
        });
      } catch (err) {
        console.error("Muhammad handoff notify error:", err);
      }

      return {
        text: isAr
          ? `✅ شكراً ${data.name}! تم إرسال طلبك لمحمد بنجاح.\n\nمحمد سيتواصل معك قريباً إن شاء الله! 🙏\n\nهل بقدر أساعدك بشي ثاني؟`
          : `✅ תודה ${data.name}! ההודעה נשלחה למוחמד.\n\nמוחמד יחזור אליך בהקדם! 🙏\n\nאפשר לעזור במשהו נוסף?`,
        quickReplies: isAr
          ? ["📱 المنتجات", "📡 الباقات", "📦 حالة طلبي", "🏪 المتجر"]
          : ["📱 מוצרים", "📡 חבילות", "📦 הזמנה", "🏪 חנות"],
      };

    default:
      session.muhammadStep = 0;
      return { text: isAr ? "كيف بقدر أساعدك؟" : "איך אפשר לעזור?" };
  }
}

// ===== Notification Templates (kept for backward compat) =====
export function buildOrderNotification(orderId: string, customerName: string, total: number, source: string): string {
  return `🆕 *طلب جديد!*\n\n📦 ${orderId}\n👤 ${customerName}\n💰 ₪${total.toLocaleString()}\n📡 المصدر: ${source}\n\n🔗 https://clalmobile.com/crm/orders?search=${orderId}`;
}

export function buildStatusNotification(orderId: string, status: string): string {
  const statusText = ORDER_STATUS_AR[status] || status;
  return `📦 *تحديث طلبك ${orderId}*\n\n${statusText}\n\nللاستفسار: https://clalmobile.com/store`;
}

// ===== Legacy Types (kept for backward compat) =====
export interface ChatMessage {
  id: string;
  role: "user" | "bot" | "system";
  text: string;
  quickReplies?: string[];
  timestamp: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  source: "whatsapp" | "webchat";
  customerPhone?: string;
  customerName?: string;
  escalated: boolean;
  createdAt: string;
}
