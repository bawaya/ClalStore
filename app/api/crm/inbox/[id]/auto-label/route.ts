export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";
import { trackAIUsage } from "@/lib/ai/usage-tracker";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
    }

    const { data: messages } = await supabase
      .from("inbox_messages")
      .select("direction, content, message_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!messages || messages.length < 2) {
      return NextResponse.json({ success: true, labels: [] });
    }

    const { data: existingLabels } = await supabase
      .from("inbox_labels")
      .select("id, name, color");

    const labelNames = (existingLabels || []).map((l: any) => l.name);

    const transcript = messages
      .map((m: any) => `${m.direction === "in" ? "زبون" : "موظف"}: ${m.content || `[${m.message_type}]`}`)
      .join("\n");

    const systemPrompt = `أنت محلل محادثات CRM في متجر ClalMobile (أجهزة ذكية + باقات HOT Mobile).

بناءً على المحادثة، اقترح 1-3 تصنيفات مناسبة من القائمة التالية (أو تصنيفات جديدة):

التصنيفات الحالية: ${labelNames.length > 0 ? labelNames.join(", ") : "لا يوجد"}

أمثلة لتصنيفات جديدة: شكوى, استفسار سعر, طلب جديد, مشكلة توصيل, استبدال, ضمان, عميل VIP, متابعة, باقات

أجب بـ JSON فقط:
{"labels": [{"name": "اسم التصنيف", "is_existing": true/false}]}`;

    const cleaned = cleanAlternatingMessages([
      { role: "user", content: transcript },
    ]);

    const apiKey = process.env.ANTHROPIC_API_KEY_BOT || process.env.ANTHROPIC_API_KEY;
    const result = await callClaude({
      systemPrompt,
      messages: cleaned,
      maxTokens: 200,
      temperature: 0.3,
      jsonMode: true,
      apiKey,
    });

    if (!result?.json) {
      return NextResponse.json({ success: true, labels: [] });
    }

    trackAIUsage({
      feature: "summary",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId,
    });

    const suggested = (result.json as any).labels || [];

    const enriched = suggested.map((s: any) => {
      const existing = (existingLabels || []).find(
        (l: any) => l.name === s.name
      );
      return {
        name: s.name,
        id: existing?.id || null,
        color: existing?.color || "#6366f1",
        is_existing: !!existing,
      };
    });

    return NextResponse.json({ success: true, labels: enriched });
  } catch (err: any) {
    console.error("Auto-label error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
