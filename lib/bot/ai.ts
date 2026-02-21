// =====================================================
// ClalMobile — AI Contextual Engine (Anthropic Claude)
// Provides intelligent, context-aware responses
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 400;

// ===== System prompt (store knowledge) =====
const SYSTEM_PROMPT = `أنت مساعد مبيعات ذكي لمتجر ClalMobile — وكيل رسمي لـ HOT Mobile في إسرائيل.

📍 معلومات المتجر:
- الاسم: ClalMobile (كلال موبايل)
- نحن كول سنتر (مركز اتصال) — لا يوجد لدينا محل أو فرع للزيارة
- نعمل فقط عبر الموقع والواتساب والتوصيل لكل أنحاء إسرائيل
- الموقع: https://clalmobile.com
- المتجر: https://clalmobile.com/store
- فورم التواصل: https://clalmobile.com/contact

📱 المنتجات:
- هواتف ذكية: Apple (iPhone), Samsung (Galaxy), Xiaomi, Oppo, Google Pixel, ZTE
- إكسسوارات: أغطية حماية، حمايات شاشة، شواحن أصلية
- باقات HOT Mobile: إنترنت + مكالمات

💰 طرق الدفع:
- لا يوجد دفع كاش/نقدي — جميع المدفوعات عبر تحويل بنكي فقط
- من دفعة واحدة حتى 18 دفعة بدون فوائد (حوالة بنكية)
- البنوك المقبولة: هبوعليم، لئومي، ديسكونت، مزراحي طفحوت، البنك الدولي، يهاف، مركنتيل، أوتسار هحيال، الاتحاد، مساد، القدس، دكسيا، بوعلي أغودات، البنك العربي الإسرائيلي
- لا نقبل بنك البريد (الدوائر / בנק הדואר)
- لا نقبل الدفع النقدي (كاش) نهائياً

🚚 التوصيل:
- شحن مجاني لكل البلاد
- توصيل لباب البيت
- ضمان 2-3 سنوات على كل الأجهزة
- أسعار منافسة ومحدّثة يومياً

📋 القواعد:
1. رد بنفس لغة الزبون (عربي أو عبري أو إنجليزي)
2. كن دافئ وودود مثل بائع حقيقي
3. اجعل الردود مختصرة (1-4 أسطر) ما لم يطلب الزبون تفاصيل
4. وجّه الزبون دائماً نحو الشراء من الموقع أو التواصل عبر واتساب — لا تقل أبداً "زورنا" أو "تعال للمحل" لأنه لا يوجد محل
5. إذا ما عرفت إجابة دقيقة، وجّه الزبون لفورم التواصل: clalmobile.com/contact
13. لا تعطِ الزبون أي رقم هاتف أبداً — لا رقم المحل ولا رقم محمد ولا أي رقم موظف. وجّهه دائماً للموقع أو فورم التواصل
6. استخدم إيموجي بشكل طبيعي بدون مبالغة
7. لا تكشف أبداً عن أسعار جملة أو هوامش ربح أو معلومات داخلية
8. عند التوصية بمنتج، أضف رابط المتجر: clalmobile.com/store
9. كن استباقي — اقترح منتجات، اسأل عن التفضيلات
10. لا تخترع أسعار أو مواصفات — إذا ما عندك معلومة دقيقة خلي الزبون يتواصل عبر واتساب
11. لا ترد كأنك AI/ذكاء اصطناعي — أنت مساعد مبيعات ClalMobile
12. إذا سأل الزبون عن الدفع الكاش أو النقدي، قل له أننا نقبل فقط تحويل بنكي من 1-18 دفعة`;

// ===== Types =====
interface ConversationMessage {
  role: "user" | "bot";
  content: string;
}

interface AIContext {
  customerName?: string;
  lastProducts?: string[];
  qualification?: Record<string, unknown>;
  language: "ar" | "he" | "en";
}

// ===== Load conversation history from DB =====
export async function getConversationHistory(
  conversationId: string,
  limit = 10
): Promise<ConversationMessage[]> {
  try {
    const s = createAdminSupabase();
    const { data } = await s
      .from("bot_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!data) return [];

    return data
      .filter((m: any) => m.role === "user" || m.role === "bot")
      .map((m: any) => ({
        role: m.role as "user" | "bot",
        content: m.content,
      }));
  } catch {
    return [];
  }
}

// ===== Load recent products from DB for context =====
async function getProductContext(productIds: string[]): Promise<string> {
  if (!productIds.length) return "";
  try {
    const s = createAdminSupabase();
    const { data } = await s
      .from("products")
      .select("name_ar, brand, price, stock")
      .in("id", productIds.slice(0, 5));

    if (!data || data.length === 0) return "";

    return data.map((p: any) =>
      `${p.brand} ${p.name_ar} — ${Number(p.price).toLocaleString()}₪ (${p.stock > 0 ? "متوفر" : "غير متوفر"})`
    ).join("\n");
  } catch {
    return "";
  }
}

// ===== Main AI response function =====
export async function getAIResponse(
  conversationId: string,
  currentMessage: string,
  context: AIContext
): Promise<{ text: string; quickReplies?: string[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — AI responses disabled");
    return null;
  }

  try {
    // 1. Load conversation history
    const history = await getConversationHistory(conversationId);

    // 2. Load product context if available
    const productInfo = context.lastProducts?.length
      ? await getProductContext(context.lastProducts)
      : "";

    // 3. Build system prompt with context
    let systemPrompt = SYSTEM_PROMPT;
    if (context.customerName) {
      systemPrompt += `\n\nاسم الزبون: ${context.customerName}`;
    }
    if (productInfo) {
      systemPrompt += `\n\nالمنتجات التي تم مناقشتها مع الزبون:\n${productInfo}`;
    }

    // 4. Build Claude messages (last N messages + current)
    const claudeMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of history.slice(-8)) {
      claudeMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
    // Add current message
    claudeMessages.push({ role: "user", content: currentMessage });

    // Ensure messages alternate correctly (Claude requirement)
    const cleaned = cleanAlternatingMessages(claudeMessages);

    // 5. Call Anthropic API
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: cleaned,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("Anthropic API error:", res.status, errorText);
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;

    // 6. Generate contextual quick replies
    const quickReplies = generateQuickReplies(text, context.language);

    return { text, quickReplies };
  } catch (err) {
    console.error("AI response error:", err);
    return null;
  }
}

// ===== Ensure messages alternate user/assistant =====
function cleanAlternatingMessages(
  messages: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  if (messages.length === 0) return [{ role: "user", content: "مرحبا" }];

  const cleaned: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of messages) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === msg.role) {
      // Merge consecutive same-role messages
      last.content += "\n" + msg.content;
    } else {
      cleaned.push({ ...msg });
    }
  }

  // Ensure first message is from user
  if (cleaned[0]?.role === "assistant") {
    cleaned.unshift({ role: "user", content: "مرحبا" });
  }

  // Ensure last message is from user
  if (cleaned[cleaned.length - 1]?.role === "assistant") {
    cleaned.push({ role: "user", content: "..." });
  }

  return cleaned;
}

// ===== Generate quick replies based on context =====
function generateQuickReplies(responseText: string, lang: "ar" | "he" | "en"): string[] {
  const isAr = lang !== "he";

  // Check response content to suggest relevant quick replies
  const text = responseText.toLowerCase();

  if (/منتج|جهاز|هاتف|מוצר|מכשיר|טלפון/i.test(text)) {
    return isAr
      ? ["📱 المنتجات", "💰 كم القسط؟", "👤 كلم موظف"]
      : ["📱 מוצרים", "💰 תשלומים?", "👤 נציג"];
  }

  if (/باقة|خط|חבילה|קו/i.test(text)) {
    return isAr
      ? ["📡 الباقات", "📱 المنتجات", "👤 كلم موظف"]
      : ["📡 חבילות", "📱 מוצרים", "👤 נציג"];
  }

  if (/سعر|ثمن|מחיר/i.test(text)) {
    return isAr
      ? ["💰 كم القسط؟", "📱 المنتجات", "🛒 أبغى أطلب"]
      : ["💰 תשלומים?", "📱 מוצרים", "🛒 לרכוש"];
  }

  // Default
  return isAr
    ? ["📱 المنتجات", "📡 الباقات", "📦 حالة طلبي", "👤 كلم موظف"]
    : ["📱 מוצרים", "📡 חבילות", "📦 הזמנה", "👤 נציג"];
}
