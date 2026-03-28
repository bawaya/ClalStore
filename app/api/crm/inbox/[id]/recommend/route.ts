export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";
import { trackAIUsage } from "@/lib/ai/usage-tracker";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

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
      .select("direction, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(15);

    const { data: products } = await supabase
      .from("products")
      .select("id, name_ar, brand, price, stock, type")
      .eq("active", true)
      .gt("stock", 0)
      .order("sold", { ascending: false })
      .limit(30);

    if (!messages || messages.length === 0 || !products || products.length === 0) {
      return apiSuccess({ recommendations: [] });
    }

    const transcript = messages
      .map((m: any) => `${m.direction === "inbound" ? "زبون" : "موظف"}: ${m.content}`)
      .join("\n");

    const catalog = products
      .map((p: any) => `[${p.id}] ${p.brand} ${p.name_ar} — ${Number(p.price).toLocaleString()}₪ (${p.type}, مخزون: ${p.stock})`)
      .join("\n");

    const systemPrompt = `أنت مساعد مبيعات ذكي لمتجر ClalMobile. بناءً على المحادثة مع الزبون، اختر 2-4 منتجات مناسبة من الكتالوج.

الكتالوج:
${catalog}

أجب بـ JSON فقط:
{"recommendations": [{"id": "product_id", "reason": "سبب التوصية بجملة واحدة"}]}

القواعد:
- اختر بناءً على ما ذكره الزبون (ميزانية, ماركة, استخدام)
- أضف إكسسوار واحد إن أمكن (upsell)
- لا تقترح منتجات غير موجودة بالكتالوج`;

    const apiKey = process.env.ANTHROPIC_API_KEY_BOT || process.env.ANTHROPIC_API_KEY;
    const cleaned = cleanAlternatingMessages([
      { role: "user", content: transcript },
    ]);

    const result = await callClaude({
      systemPrompt,
      messages: cleaned,
      maxTokens: 300,
      temperature: 0.4,
      jsonMode: true,
      apiKey,
    });

    if (!result?.json) {
      return apiSuccess({ recommendations: [] });
    }

    trackAIUsage({
      feature: "smart_search",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId,
    });

    const recs = ((result.json as any).recommendations || []) as {
      id: string;
      reason: string;
    }[];

    const enriched = recs
      .map((r) => {
        const product = products.find((p: any) => p.id === r.id);
        if (!product) return null;
        return {
          id: product.id,
          name: (product as any).name_ar,
          brand: (product as any).brand,
          price: Number((product as any).price),
          type: (product as any).type,
          reason: r.reason,
        };
      })
      .filter(Boolean);

    return apiSuccess({ recommendations: enriched });
  } catch (err: unknown) {
    console.error("Recommend API error:", err);
    return apiError(errMsg(err), 500);
  }
}
