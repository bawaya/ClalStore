export const runtime = "edge";

// =====================================================
// ClalMobile — AI Smart Reply Suggestion
// POST /api/crm/inbox/[id]/suggest
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { callClaude, cleanAlternatingMessages } from "@/lib/ai/claude";
import { getProductByQuery } from "@/lib/ai/product-context";
import { trackAIUsage } from "@/lib/ai/usage-tracker";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const convId = params.id;
    const body = await req.json().catch(() => ({}));
    const agentContext = (body as { context?: string }).context || "";

    // 1. Fetch conversation
    const { data: conversation, error: convErr } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", convId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ success: false, error: "المحادثة غير موجودة" }, { status: 404 });
    }

    // 2. Fetch last 15 messages
    const { data: messages } = await supabase
      .from("inbox_messages")
      .select("direction, sender_type, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(15);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: false, error: "لا توجد رسائل" }, { status: 400 });
    }

    // 3. Fetch customer info
    let customerInfo = "";
    if (conversation.customer_phone) {
      const phone = (conversation.customer_phone as string).replace(/[-\s+]/g, "");
      const phoneVariants = [phone];
      if (phone.startsWith("972")) phoneVariants.push("0" + phone.slice(3));
      if (phone.startsWith("0")) phoneVariants.push("972" + phone.slice(1));

      for (const pv of phoneVariants) {
        const { data: cust } = await supabase
          .from("customers")
          .select("name, city, total_orders, total_spent, segment, created_at")
          .eq("phone", pv)
          .single();
        if (cust) {
          const isVip = cust.segment === "vip" || (cust.total_spent || 0) > 5000;
          customerInfo = `- الاسم: ${cust.name || "غير معروف"}
- المدينة: ${cust.city || "غير محدد"}
- عميل منذ: ${new Date(cust.created_at).toLocaleDateString("ar-EG")}
- عدد الطلبات: ${cust.total_orders || 0} — إجمالي: ₪${(cust.total_spent || 0).toLocaleString()}
- VIP: ${isVip ? "نعم ⭐" : "لا"}`;
          break;
        }
      }
    }

    // 4. Fetch internal notes
    const { data: notes } = await supabase
      .from("inbox_notes")
      .select("content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(5);

    const notesText = notes?.length
      ? notes.map((n: any) => `• ${n.content}`).join("\n")
      : "لا توجد ملاحظات";

    // 5. Extract product context from conversation
    const allText = messages.map((m: any) => m.content || "").join(" ");
    const productContext = await getProductByQuery(allText);

    // 6. Build system prompt
    const systemPrompt = `أنت مساعد ذكي لفريق مبيعات ClalMobile — وكيل HOT Mobile الرسمي.
مهمتك: اقتراح رد احترافي للموظف ليرسله للعميل عبر WhatsApp.

معلومات العميل:
${customerInfo || "غير متوفرة"}

ملاحظات الفريق:
${notesText}

المنتجات المتوفرة المتعلقة بالمحادثة:
${productContext || "لا توجد منتجات متعلقة"}

${agentContext ? `ملاحظة من الموظف: ${agentContext}` : ""}

قواعد الرد:
1. اكتب بلغة العميل (عربي/عبري) — نفس لغة آخر رسالة له
2. كن ودوداً ومهنياً — أسلوب مبيعات ذكي
3. اذكر الأسعار بالشيكل (₪) إذا سأل عنها
4. اذكر الأقساط إذا مناسب (حتى 18 قسط بتحويل بنكي بدون فوائد)
5. لا تكتب أكثر من 3-4 أسطر
6. أضف إيموجي مناسب (1-2 فقط)
7. إذا العميل غاضب — اعتذر أولاً ثم ساعد
8. إذا العميل VIP — عامله بشكل مميز
9. لا تعطِ وعود كاذبة — إذا لا تعرف قل "سأتحقق"
10. لا تكشف أسعار جملة أو هوامش ربح
11. التوصيل: 1-3 أيام عمل، شحن مجاني لكل البلاد
12. الضمان: 2-3 سنوات للأجهزة
13. ساعات العمل: أحد-خميس 9-18
14. نحن كول سنتر — لا محل ولا فرع — فقط واتساب وموقع
15. لا تعطي أي رقم هاتف — وجّه للموقع clalmobile.com أو فورم التواصل`;

    // 7. Build Claude messages
    const claudeMessages: { role: "user" | "assistant"; content: string }[] = messages.map((m: any) => ({
      role: m.direction === "inbound" ? "user" as const : "assistant" as const,
      content: m.content || "...",
    }));
    claudeMessages.push({ role: "user", content: "اقترح رداً مناسباً لآخر رسالة من العميل." });

    const cleaned = cleanAlternatingMessages(claudeMessages);

    // 8. Call Claude
    const result = await callClaude({
      systemPrompt,
      messages: cleaned,
      maxTokens: 500,
      temperature: 0.7,
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "تعذر اقتراح رد — حاول مجدداً" }, { status: 500 });
    }

    // 9. Track usage
    trackAIUsage({
      feature: "smart_reply",
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      durationMs: result.duration,
      conversationId: convId,
    });

    // 10. Detect tone
    const text = result.text;
    let tone: "friendly" | "formal" | "apologetic" = "friendly";
    if (/آسف|نعتذر|معذرة|عفوا|سليחה/i.test(text)) tone = "apologetic";
    else if (/سيدي|حضرتك|אדוני/i.test(text)) tone = "formal";

    return NextResponse.json({
      success: true,
      suggestion: text,
      tone,
      confidence: 0.85,
    });
  } catch (err: any) {
    console.error("Smart reply error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
