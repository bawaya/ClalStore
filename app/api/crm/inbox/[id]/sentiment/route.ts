
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { cleanAlternatingMessages } from "@/lib/ai/claude";
import { callConfiguredAI } from "@/lib/ai/runtime";
import { trackAIUsage } from "@/lib/ai/usage-tracker";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id: conversationId } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("DB error", 500);
    }

    const { data: messages } = await supabase
      .from("inbox_messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!messages || messages.length === 0) {
      return apiSuccess({ sentiment: "neutral", confidence: 0 });
    }

    const customerMsgs = messages
      .filter((m: any) => m.direction === "inbound")
      .slice(0, 5);

    if (customerMsgs.length === 0) {
      return apiSuccess({ sentiment: "neutral", confidence: 0 });
    }

    const transcript = customerMsgs
      .reverse()
      .map((m: any) => m.content)
      .join("\n");

    const systemPrompt = `حلل المشاعر في رسائل هذا الزبون. أجب بـ JSON فقط:
{"sentiment": "positive|neutral|negative|angry", "confidence": 0.0-1.0, "reason": "سبب قصير"}

القواعد:
- angry: شتائم, تهديدات, استياء شديد, مطالبة بمدير
- negative: إحباط, شكوى, عدم رضا
- neutral: سؤال عادي, استفسار
- positive: شكر, رضا, حماس`;

    const cleaned = cleanAlternatingMessages([
      { role: "user", content: transcript },
    ]);

    const result = await callConfiguredAI({
      systemPrompt,
      messages: cleaned,
      maxTokens: 100,
      temperature: 0.2,
      jsonMode: true,
    }, "bot");

    if (!result?.json) {
      return apiSuccess({ sentiment: "neutral", confidence: 0 });
    }

    trackAIUsage({
      feature: "sentiment",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId,
    });

    const sentiment = (result.json as any).sentiment || "neutral";
    const confidence = (result.json as any).confidence || 0;
    const reason = (result.json as any).reason || "";

    await supabase
      .from("inbox_conversations")
      .update({ sentiment } as any)
      .eq("id", conversationId);

    return apiSuccess({ sentiment, confidence, reason });
  } catch (err: unknown) {
    console.error("Sentiment API error:", err);
    return apiError("فشل في تحليل المشاعر", 500);
  }
}
