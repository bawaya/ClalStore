export const runtime = "edge";

// =====================================================
// ClalMobile — AI Conversation Summary
// POST /api/crm/inbox/[id]/summary
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";
import { trackAIUsage } from "@/lib/ai/usage-tracker";

export interface ConversationSummary {
  summary: string;
  products: string[];
  status: string;
  action_required: string;
  priority: "high" | "normal" | "low";
  sentiment: "positive" | "neutral" | "negative" | "angry";
  language: string;
  generated_at: string;
  message_count_at_generation: number;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const convId = params.id;
    const body = await req.json().catch(() => ({}));
    const forceRefresh = (body as { force?: boolean }).force === true;

    // 1. Fetch conversation
    const { data: conversation, error: convErr } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", convId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ success: false, error: "المحادثة غير موجودة" }, { status: 404 });
    }

    // 2. Check cached summary
    const metadata = (conversation.metadata as Record<string, unknown>) || {};
    const cachedSummary = metadata.ai_summary as ConversationSummary | undefined;

    // 3. Count current messages
    const { count: msgCount } = await supabase
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convId);

    const currentMsgCount = msgCount || 0;

    // Return cached if fresh enough (less than 3 new messages since last generation)
    if (
      cachedSummary &&
      !forceRefresh &&
      currentMsgCount - (cachedSummary.message_count_at_generation || 0) < 3
    ) {
      return NextResponse.json({
        success: true,
        summary: cachedSummary,
        cached: true,
      });
    }

    // 4. Fetch all messages (up to 50)
    const { data: messages } = await supabase
      .from("inbox_messages")
      .select("direction, sender_type, content, message_type, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!messages || messages.length < 3) {
      return NextResponse.json({
        success: false,
        error: "المحادثة قصيرة جداً للتلخيص",
      }, { status: 400 });
    }

    // 5. Fetch customer
    let customerName = conversation.customer_name || "عميل";
    if (conversation.customer_phone) {
      const phone = (conversation.customer_phone as string).replace(/[-\s+]/g, "");
      const phoneVariants = [phone];
      if (phone.startsWith("972")) phoneVariants.push("0" + phone.slice(3));
      if (phone.startsWith("0")) phoneVariants.push("972" + phone.slice(1));

      for (const pv of phoneVariants) {
        const { data: cust } = await supabase
          .from("customers")
          .select("name")
          .eq("phone", pv)
          .single();
        if (cust) { customerName = cust.name || customerName; break; }
      }
    }

    // 6. Build system prompt
    const systemPrompt = `أنت محلل محادثات لفريق مبيعات ClalMobile.
لخّص هذه المحادثة بشكل مختصر ومفيد للموظف.

اسم العميل: ${customerName}

أعطني:
1. **الملخص** (2-3 جمل): ماذا يريد العميل؟
2. **المنتجات المذكورة**: قائمة بأسماء المنتجات/الماركات
3. **الحالة**: (interested_in_buying / inquiring / angry / waiting_for_reply / resolved)
4. **الإجراء المطلوب**: ماذا يجب أن يفعل الموظف الآن؟
5. **الأولوية**: (high / normal / low)
6. **المزاج**: (positive / neutral / negative / angry)
7. **اللغة**: (ar / he / en)

أجب بـ JSON فقط بدون أي نص إضافي:
{
  "summary": "...",
  "products": ["iPhone 16 Pro Max", "AirPods Pro"],
  "status": "interested_in_buying",
  "action_required": "إرسال عرض سعر مع أقساط",
  "priority": "high",
  "sentiment": "positive",
  "language": "ar"
}`;

    // 7. Build messages for Claude
    const claudeMessages: { role: "user" | "assistant"; content: string }[] = messages.map((m: any) => ({
      role: m.direction === "inbound" ? "user" as const : "assistant" as const,
      content: m.content || `[${m.message_type}]`,
    }));
    claudeMessages.push({ role: "user", content: "لخّص هذه المحادثة." });

    const cleaned = cleanAlternatingMessages(claudeMessages);

    // 8. Call Claude
    const result = await callClaude({
      systemPrompt,
      messages: cleaned,
      maxTokens: 500,
      temperature: 0.3,
      jsonMode: true,
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "تعذر تلخيص المحادثة" }, { status: 500 });
    }

    // 9. Track usage
    trackAIUsage({
      feature: "summary",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId: convId,
    });

    // 10. Build summary object
    const parsed = result.json || {};
    const summary: ConversationSummary = {
      summary: (parsed.summary as string) || result.text.slice(0, 200),
      products: (parsed.products as string[]) || [],
      status: (parsed.status as string) || "inquiring",
      action_required: (parsed.action_required as string) || "",
      priority: (parsed.priority as "high" | "normal" | "low") || "normal",
      sentiment: (parsed.sentiment as "positive" | "neutral" | "negative" | "angry") || "neutral",
      language: (parsed.language as string) || "ar",
      generated_at: new Date().toISOString(),
      message_count_at_generation: currentMsgCount,
    };

    // 11. Cache in conversation metadata
    const updatedMetadata = { ...metadata, ai_summary: summary };
    await supabase
      .from("inbox_conversations")
      .update({
        metadata: updatedMetadata,
        sentiment: summary.sentiment,
      })
      .eq("id", convId);

    return NextResponse.json({
      success: true,
      summary,
      cached: false,
    });
  } catch (err: any) {
    console.error("Summary error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
