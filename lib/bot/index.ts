// =====================================================
// ClalMobile — Bot Module Index (Season 5)
// =====================================================

// Engine (main entry + types)
export { processMessage, buildOrderNotification, buildStatusNotification, logBotInteraction } from "./engine";
export type { BotIntent, DetectedIntent, BotResponse, ChatMessage, ChatSession } from "./engine";

// Intent Detection
export { detectIntent } from "./intents";

// WhatsApp
export { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppTemplate, notifyTeam, parseWebhook, normalizePhone, handleWhatsAppMessage, sendBotResponse } from "./whatsapp";

// WebChat
export { handleWebChatMessage, formatWebChatResponse, getWelcomeMessage } from "./webchat";

// Notifications (preserved)
export { notifyNewOrder, notifyStatusChange, sendNoReplyReminder } from "./notifications";

// Playbook
export { searchProducts, searchByModel, recommendProducts, lookupOrder, formatProductCards, calculateInstallments, getLinePlans } from "./playbook";

// Templates & Policies
export { getTemplate, invalidateTemplateCache } from "./templates";
export { getPolicy, invalidatePolicyCache } from "./policies";

// Analytics
export { getOrCreateConversation, getAnalyticsSummary } from "./analytics";

// AI (Anthropic Claude)
export { getAIResponse, getConversationHistory } from "./ai";

// Handoff
export { createHandoff, getPendingHandoffs, resolveHandoff } from "./handoff";

// Guardrails
export { isWithinWorkingHours } from "./guardrails";
