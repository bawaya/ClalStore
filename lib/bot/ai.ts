// =====================================================
// ClalMobile — AI Contextual Engine (Anthropic Claude)
// Provides intelligent, context-aware responses
// Uses shared callClaude() from lib/ai/claude.ts
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";
import { callGemini } from "@/lib/ai/gemini";
import { getProductByQuery } from "@/lib/ai/product-context";
import { trackAIUsage } from "@/lib/ai/usage-tracker";

// ===== System prompt (store knowledge) =====
const SYSTEM_PROMPT = `أنت مستشار مبيعات محترف وذكي جداً لمتجر ClalMobile — وكيل رسمي لـ HOT Mobile في إسرائيل.
أنت تتمتع بدهاء استراتيجي في المبيعات، تفهم احتياج العميل بعمق قبل اقتراح الحلول، وتعرض المنتجات بذكاء وقناعة.

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

📋 القواعد (يجب اتباعها بصرامة):
1. تحدث بأسلوب مستشار مبيعات خبير وذكي، يمتلك دهاء وقدرة عالية على الإقناع، مع الحفاظ على الاحترافية.
2. ممنوع منعاً باتاً استخدام كلمات التودد المفرط والدارجة مثل: "حبيبي"، "يا عمري"، "يا روحي"، "غلاتي". اجعل نبرتك محترفة وجذابة.
3. اسأل أسئلة ذكية أولاً لتفهم احتياج العميل الحقيقي وسياق استخدامه، ثم اطرح الحلول والمنتجات بناءً على ما يناسبه. اعتمد أسلوب البيع الاستشاري (Consultative Selling).
4. رد بنفس لغة الزبون (عربي أو عبري أو إنجليزي).
5. اجعل الردود مركزة ومختصرة (1-4 أسطر) ما لم يطلب الزبون تفاصيل.
6. وجّه الزبون دائماً نحو الشراء من الموقع — لا تقل أبداً "زورنا" أو "تعال للمحل" لأنه لا يوجد محل.
7. لا تعطِ الزبون أي رقم هاتف أبداً. وجّهه دائماً للموقع أو فورم التواصل أو زر الشراء.
8. استخدم إيموجي بشكل طبيعي واحترافي لتعزيز الرسالة، بدون مبالغة.
9. لا تكشف أبداً عن أسعار جملة أو هوامش ربح أو معلومات داخلية.
10. عند التوصية بمنتج، أبرز قيمته بذكاء واربطه باحتياج العميل، وأضف رابط المتجر: clalmobile.com/store.
11. لا تخترع أسعار أو مواصفات — إذا لم تتأكد من المعلومة وجّه الزبون لفورم: clalmobile.com/contact.
12. لا تظهر أو ترد كأنك AI/ذكاء اصطناعي إطلاقاً.
13. إذا سأل الزبون عن الدفع הכاش أو النقدي، قل له بثقة أننا نقبل فقط الدفع المريح بالتحويل البنكي لغاية 18 دفعة بدون أي فوائد.`;

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

// ===== Load recent products from DB for context — now uses RAG =====
async function getProductContextForBot(
  productIds: string[],
  currentMessage: string
): Promise<string> {
  // Try RAG query first (search by message content)
  const ragContext = await getProductByQuery(currentMessage);
  if (ragContext) return ragContext;

  // Fallback to specific product IDs if available
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
  const sb = createAdminSupabase();
  const { data: dbIntegration } = await sb
    .from("integrations")
    .select("provider, config")
    .eq("type", "ai_chat")
    .single();

  const provider = dbIntegration?.provider || "Anthropic Claude";
  const integrationConfig = dbIntegration?.config || {};

  let apiKey = "";
  if (provider === "Google Gemini") {
    apiKey = integrationConfig.api_key || process.env.GEMINI_API_KEY || "AIzaSyDQYgEfgo2itJfVWkdKNIryq6qw8JIxUI0";
  } else {
    apiKey = integrationConfig.api_key || process.env.ANTHROPIC_API_KEY_BOT || process.env.ANTHROPIC_API_KEY || "";
  }

  if (!apiKey) {
    console.warn(`[AI] ${provider} API key not set — AI responses disabled`);
    return null;
  }

  try {
    // 1. Load conversation history
    const history = await getConversationHistory(conversationId);

    // 2. Load product context via RAG
    const productInfo = await getProductContextForBot(
      context.lastProducts || [],
      currentMessage
    );

    // 3. Build system prompt with context
    let systemPrompt = SYSTEM_PROMPT;
    if (context.customerName) {
      systemPrompt += `\n\nاسم الزبون: ${context.customerName}`;
    }
    if (productInfo) {
      systemPrompt += `\n\nكتالوج المنتجات المتعلقة بالمحادثة (أسعار حقيقية ودقيقة — استخدمها):\n${productInfo}`;
      systemPrompt += `\n\nقاعدة مهمة: اذكر الأسعار الدقيقة من الكتالوج — لا تخمن أبداً.`;
      systemPrompt += `\nإذا المنتج غير متوفر (كمية 0) أخبر الزبون.`;
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

    // Ensure messages alternate correctly (Claude requirement, works for Gemini too)
    const cleaned = cleanAlternatingMessages(claudeMessages);

    // 5. Call AI via selected client
    let result;
    if (provider === "Google Gemini") {
      result = await callGemini({
        systemPrompt,
        messages: cleaned,
        maxTokens: 400,
        temperature: 0.7,
        apiKey,
      });
    } else {
      result = await callClaude({
        systemPrompt,
        messages: cleaned,
        maxTokens: 400,
        temperature: 0.7,
        apiKey,
      });
    }

    if (!result) return null;

    // 6. Track usage
    trackAIUsage({
      feature: "bot_reply",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId,
    });

    // 7. Generate contextual quick replies
    const quickReplies = generateQuickReplies(result.text, context.language);

    return { text: result.text, quickReplies };
  } catch (err) {
    console.error("AI response error:", err);
    return null;
  }
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
