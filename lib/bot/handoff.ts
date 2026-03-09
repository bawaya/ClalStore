// =====================================================
// ClalMobile — Bot Handoff (Human Escalation)
// Create handoff records + tasks + notify team
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";
import { trackAIUsage } from "@/lib/ai/usage-tracker";
import { notifyTeam, notifyAdmin } from "./admin-notify";

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

    // 5. Notify admin + team via WhatsApp (FROM report phone, NOT bot phone)
    try {
      const teamMsg = `🔔 *تصعيد بوت جديد*\n\n` +
        `📝 السبب: ${req.reason}\n` +
        `👤 ${req.customerName || "زائر"}\n` +
        `\n📋 الملخص:\n${req.summary.slice(0, 200)}\n` +
        `\n🔗 https://clalmobile.com/crm`;

      // Send to admin directly
      await notifyAdmin(teamMsg);
      // Send to team members
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

// ===== Generate conversation summary (AI-powered with rule-based fallback) =====
export async function generateConversationSummary(conversationId: string): Promise<string> {
  try {
    const { data: messages } = await db()
      .from("bot_messages")
      .select("role, content, intent")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(25);

    if (!messages || messages.length === 0) return "لا توجد رسائل";

    const aiSummary = await generateAISummary(messages, conversationId);
    if (aiSummary) return aiSummary;

    const userMessages = messages.filter((m: any) => m.role === "user");
    const intents = [...new Set(messages.filter((m: any) => m.intent).map((m: any) => m.intent))];

    return [
      `عدد الرسائل: ${messages.length}`,
      `النوايا: ${intents.join(", ") || "غير محدد"}`,
      `آخر رسالة: "${userMessages[userMessages.length - 1]?.content?.slice(0, 100) || ""}"`,
    ].join("\n");
  } catch {
    return "فشل في توليد الملخص";
  }
}

async function generateAISummary(
  messages: any[],
  conversationId: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY_BOT || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const transcript = messages
      .map((m: any) => `${m.role === "user" ? "زبون" : "بوت"}: ${m.content}`)
      .join("\n");

    const intents = [...new Set(messages.filter((m: any) => m.intent).map((m: any) => m.intent))];

    const systemPrompt = `أنت محلل محادثات في CRM متجر ClalMobile.
اكتب ملخص مختصر (3-5 أسطر) لهذه المحادثة يتضمن:
1. ما يريده الزبون (المنتج/الخدمة)
2. المشكلة أو السبب الرئيسي للتصعيد
3. أي منتجات ذُكرت
4. الخطوة التالية المطلوبة من الموظف
5. مستوى الإلحاح (عادي/مرتفع/عاجل)

اكتب بالعربية فقط. لا تكتب JSON — نص عادي فقط.`;

    const cleaned = cleanAlternatingMessages([
      { role: "user", content: `النوايا المكتشفة: ${intents.join(", ")}\n\nالمحادثة:\n${transcript}` },
    ]);

    const result = await callClaude({
      systemPrompt,
      messages: cleaned,
      maxTokens: 300,
      temperature: 0.3,
      apiKey,
    });

    if (!result?.text) return null;

    trackAIUsage({
      feature: "summary",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId,
    });

    return result.text;
  } catch {
    return null;
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
