// =====================================================
// ClalMobile — Bot Handoff (Human Escalation)
// Create handoff records + tasks + notify team
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import { notifyTeam } from "./whatsapp";

const db = () => createAdminSupabase();

export interface HandoffRequest {
  conversationId: string;
  customerId?: string;
  reason: string;
  summary: string;
  productsInterested?: string[];
  lastPriceQuoted?: number;
  customerPhone?: string;
  customerName?: string;
}

// ===== Create handoff =====
export async function createHandoff(req: HandoffRequest): Promise<string | null> {
  const s = db();

  try {
    // 1. Save handoff record
    const { data: handoff } = await s.from("bot_handoffs").insert({
      conversation_id: req.conversationId,
      customer_id: req.customerId || undefined,
      reason: req.reason,
      summary: req.summary,
      products_interested: req.productsInterested || [],
      last_price_quoted: req.lastPriceQuoted || undefined,
      status: "pending",
    } as any).select("id").single();

    // 2. Update conversation status
    await s.from("bot_conversations").update({
      status: "escalated",
      updated_at: new Date().toISOString(),
    }).eq("id", req.conversationId);

    // 3. Create task for follow-up
    if (req.customerId) {
      await s.from("tasks").insert({
        title: `متابعة بوت: ${req.reason}`,
        description: req.summary,
        customer_id: req.customerId,
        status: "pending",
        priority: req.reason === "complaint" ? "high" : "medium",
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any);
    }

    // 4. Create pipeline deal if products mentioned
    if (req.customerId && req.productsInterested && req.productsInterested.length > 0) {
      await s.from("pipeline_deals").insert({
        customer_id: req.customerId,
        stage: "lead",
        value: req.lastPriceQuoted || 0,
        source: "bot",
        notes: req.summary,
      } as any);
    }

    // 5. Notify team via WhatsApp
    try {
      const teamMsg = `🔔 *تصعيد بوت جديد*\n\n` +
        `📝 السبب: ${req.reason}\n` +
        `👤 ${req.customerName || "زائر"}\n` +
        `📞 ${req.customerPhone || "غير معروف"}\n` +
        `\n📋 الملخص:\n${req.summary.slice(0, 200)}\n` +
        `\n🔗 https://clalmobile.com/crm`;

      await notifyTeam(teamMsg);
    } catch {
      // Silent — notification failure shouldn't break handoff
    }

    return handoff?.id || null;
  } catch (err) {
    console.error("Failed to create handoff:", err);
    return null;
  }
}

// ===== Generate conversation summary =====
export async function generateConversationSummary(conversationId: string): Promise<string> {
  try {
    const { data: messages } = await db()
      .from("bot_messages")
      .select("role, content, intent")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!messages || messages.length === 0) return "لا توجد رسائل";

    // Build summary from message history
    const userMessages = messages.filter((m: any) => m.role === "user");
    const intents = [...new Set(messages.filter((m: any) => m.intent).map((m: any) => m.intent))];

    const summary = [
      `عدد الرسائل: ${messages.length}`,
      `النوايا: ${intents.join(", ") || "غير محدد"}`,
      `آخر رسالة: "${userMessages[userMessages.length - 1]?.content?.slice(0, 100) || ""}"`,
    ].join("\n");

    return summary;
  } catch {
    return "فشل في توليد الملخص";
  }
}

// ===== Get pending handoffs =====
export async function getPendingHandoffs() {
  const { data } = await db()
    .from("bot_handoffs")
    .select("*, bot_conversations(visitor_id, channel)" as any)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return data || [];
}

// ===== Resolve handoff =====
export async function resolveHandoff(handoffId: string, assignedTo?: string): Promise<void> {
  await db().from("bot_handoffs").update({
    status: "resolved",
    assigned_to: assignedTo || undefined,
  } as any).eq("id", handoffId);
}
