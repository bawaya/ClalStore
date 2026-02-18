// =====================================================
// ClalMobile — Bot Analytics
// Track conversations, messages, leads, clicks
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

const db = () => createAdminSupabase();

// ===== Create / Get Conversation =====
export async function getOrCreateConversation(
  visitorId: string,
  channel: "webchat" | "whatsapp" | "sms",
  opts?: { customerId?: string; language?: string; source?: string }
): Promise<string> {
  const s = db();

  // Look for active conversation
  const { data: existing } = await s
    .from("bot_conversations")
    .select("id")
    .eq("visitor_id", visitorId)
    .eq("channel", channel)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new
  const { data: created } = await s
    .from("bot_conversations")
    .insert({
      visitor_id: visitorId,
      channel: channel as "webchat" | "whatsapp",
      customer_id: opts?.customerId || undefined,
      language: opts?.language || "ar",
      source: opts?.source || undefined,
    } as any)
    .select("id")
    .single();

  return created?.id || visitorId;
}

// ===== Save Message =====
export async function saveMessage(
  conversationId: string,
  role: "user" | "bot" | "system",
  content: string,
  intent?: string,
  confidence?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const s = db();
    await s.from("bot_messages").insert({
      conversation_id: conversationId,
      role,
      content: content.slice(0, 5000),
      intent: intent || undefined,
      confidence: confidence || undefined,
      metadata: metadata || {},
    } as any);

    // Update conversation
    await s.from("bot_conversations").update({
      updated_at: new Date().toISOString(),
      intent: intent || undefined,
      message_count: undefined, // will be incremented via RPC or trigger if set up
    }).eq("id", conversationId);

  } catch (err) {
    console.error("Failed to save bot message:", err);
  }
}

// ===== Close Conversation =====
export async function closeConversation(conversationId: string): Promise<void> {
  try {
    await db().from("bot_conversations").update({
      status: "closed",
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);
  } catch (err) {
    console.error("Failed to close conversation:", err);
  }
}

// ===== Save CSAT Score =====
export async function saveCsatScore(conversationId: string, score: number): Promise<void> {
  try {
    await db().from("bot_conversations").update({
      csat_score: Math.min(5, Math.max(1, score)),
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);
  } catch (err) {
    console.error("Failed to save CSAT:", err);
  }
}

// ===== Link customer to conversation =====
export async function linkCustomer(conversationId: string, customerId: string): Promise<void> {
  try {
    await db().from("bot_conversations").update({
      customer_id: customerId,
    }).eq("id", conversationId);
  } catch (err) {
    console.error("Failed to link customer:", err);
  }
}

// ===== Add product discussed =====
export async function addProductDiscussed(conversationId: string, productId: string): Promise<void> {
  try {
    const s = db();
    const { data } = await s.from("bot_conversations").select("products_discussed").eq("id", conversationId).single();
    const existing = (data?.products_discussed || []) as string[];
    if (!existing.includes(productId)) {
      await s.from("bot_conversations").update({
        products_discussed: [...existing, productId],
      }).eq("id", conversationId);
    }
  } catch (err) {
    console.error("Failed to add product discussed:", err);
  }
}

// ===== Update daily analytics =====
export async function trackAnalytics(channel: "webchat" | "whatsapp", event: {
  newConversation?: boolean;
  newMessage?: boolean;
  leadCaptured?: boolean;
  storeClick?: boolean;
  handoff?: boolean;
  intent?: string;
  productId?: string;
}): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const s = db();

    // Upsert analytics row
    const { data: existing } = await s
      .from("bot_analytics")
      .select("*")
      .eq("date", today)
      .eq("channel", channel)
      .single();

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (event.newConversation) updates.total_conversations = (existing.total_conversations || 0) + 1;
      if (event.newMessage) updates.total_messages = (existing.total_messages || 0) + 1;
      if (event.leadCaptured) updates.leads_captured = (existing.leads_captured || 0) + 1;
      if (event.storeClick) updates.store_clicks = (existing.store_clicks || 0) + 1;
      if (event.handoff) updates.handoffs = (existing.handoffs || 0) + 1;

      if (event.intent) {
        const intents = (existing.top_intents || {}) as Record<string, number>;
        intents[event.intent] = (intents[event.intent] || 0) + 1;
        updates.top_intents = intents;
      }

      if (event.productId) {
        const products = (existing.top_products || {}) as Record<string, number>;
        products[event.productId] = (products[event.productId] || 0) + 1;
        updates.top_products = products;
      }

      if (Object.keys(updates).length > 0) {
        await s.from("bot_analytics").update(updates).eq("id", existing.id);
      }
    } else {
      await s.from("bot_analytics").insert({
        date: today,
        channel,
        total_conversations: event.newConversation ? 1 : 0,
        total_messages: event.newMessage ? 1 : 0,
        leads_captured: event.leadCaptured ? 1 : 0,
        store_clicks: event.storeClick ? 1 : 0,
        handoffs: event.handoff ? 1 : 0,
        top_intents: event.intent ? { [event.intent]: 1 } : {},
        top_products: event.productId ? { [event.productId]: 1 } : {},
      } as any);
    }
  } catch {
    // Silent — analytics shouldn't break the bot
  }
}

// ===== Get analytics summary =====
export async function getAnalyticsSummary(from?: string, to?: string, channel?: string) {
  const s = db();
  let q = s.from("bot_analytics").select("*");

  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  if (channel) q = q.eq("channel", channel);

  const { data } = await q.order("date", { ascending: false });
  return data || [];
}

// ===== Log to audit_log (legacy support) =====
export async function logBotInteraction(
  source: "whatsapp" | "webchat",
  visitorId: string | null,
  userMessage: string,
  botResponse: string,
  intent: string
): Promise<void> {
  try {
    await db().from("audit_log").insert({
      user_name: `بوت_${source}`,
      action: `[${intent}] ${userMessage.slice(0, 50)} → ${botResponse.slice(0, 80)}`,
      entity_type: "bot_chat",
      details: { source, visitor: visitorId, intent, user_msg: userMessage, bot_msg: botResponse },
    });
  } catch {
    // Silent
  }
}
