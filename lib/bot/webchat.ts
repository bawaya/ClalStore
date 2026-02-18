// =====================================================
// ClalMobile — WebChat Server Handler (Season 5)
// Server-side handler for webchat messages
// =====================================================

import { processMessage, type BotResponse, type ChatMessage } from "./engine";

// ===== Handle WebChat Message =====
export async function handleWebChatMessage(
  message: string,
  sessionId: string,
  opts?: { customerPhone?: string; customerName?: string }
): Promise<BotResponse> {
  const visitorId = `web_${sessionId}`;
  const response = await processMessage(visitorId, message, "webchat", {
    customerPhone: opts?.customerPhone,
    customerName: opts?.customerName,
    source: "webchat",
  });
  return response;
}

// ===== Format Response for WebChat API =====
export function formatWebChatResponse(response: BotResponse): {
  text: string;
  quickReplies: string[];
  escalate: boolean;
  conversationId?: string;
} {
  return {
    text: response.text,
    quickReplies: response.quickReplies || [],
    escalate: response.escalate || false,
    conversationId: response.conversationId,
  };
}

// ===== Build Initial Welcome =====
export function getWelcomeMessage(lang: "ar" | "he" = "ar"): ChatMessage {
  const isAr = lang !== "he";
  return {
    id: `welcome_${Date.now()}`,
    role: "bot",
    text: isAr
      ? "أهلاً! 👋 أنا مساعد ClalMobile\nوكيل رسمي لـ HOT Mobile\n\nكيف أقدر أساعدك؟"
      : "שלום! 👋 אני העוזר של ClalMobile\nסוכן רשמי של HOT Mobile\n\nאיך אפשר לעזור?",
    quickReplies: isAr
      ? ["📱 المنتجات", "📡 الباقات", "📦 حالة طلبي", "👤 كلم موظف"]
      : ["📱 מוצרים", "📡 חבילות", "📦 מעקב הזמנה", "👤 נציג"],
    timestamp: new Date().toISOString(),
  };
}
