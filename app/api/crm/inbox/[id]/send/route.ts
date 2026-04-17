// =====================================================
// ClalMobile — Send Message via Inbox
// POST /api/crm/inbox/[id]/send
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { sendWhatsAppText, sendWhatsAppImage, sendWhatsAppDocument } from "@/lib/bot/whatsapp";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB error", 500);

    const convId = id;
    const body = await req.json();
    const { type = "text", content, template_name, template_params, media_url, reply_to } = body;

    // Get conversation
    const { data: conv } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", convId)
      .single();

    if (!conv) {
      return apiError("المحادثة غير موجودة", 404);
    }

    if ((conv as any).is_blocked) {
      return apiError("هذا العميل محظور", 403);
    }

    // Check 24-hour window for non-template messages
    // Must check last INBOUND message time, not just last message
    if (type !== "template") {
      const { data: lastInboundMsg } = await supabase
        .from("inbox_messages")
        .select("created_at")
        .eq("conversation_id", convId)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastInboundMsg) {
        const hoursSince = (Date.now() - new Date(lastInboundMsg.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince > 24) {
          return apiError("مر 24 ساعة — يمكنك فقط إرسال قالب معتمد", 400);
        }
      }
    }

    const phone = (conv as any).customer_phone;
    let messageContent = content || "";
    let msgStatus: string = "sent";
    let errorMessage: string | null = null;
    let waMessageId: string | null = null;

    // Send via WhatsApp
    try {
      if (type === "template" && template_name) {
        const { sendWhatsAppTemplate } = await import("@/lib/bot/whatsapp");
        const paramValues = template_params ? Object.values(template_params) as string[] : [];
        const result = await sendWhatsAppTemplate(phone, template_name, paramValues);
        waMessageId = result?.id || null;
        messageContent = content || `[قالب: ${template_name}]`;
      } else if (type === "image" && media_url) {
        const result = await sendWhatsAppImage(phone, media_url, messageContent || undefined);
        waMessageId = result?.id || null;
        messageContent = messageContent || "[صورة]";
      } else if (type === "document" && media_url) {
        const filename = body.media_filename || "document";
        const result = await sendWhatsAppDocument(phone, media_url, filename, messageContent || undefined);
        waMessageId = result?.id || null;
        messageContent = messageContent || `[مستند: ${filename}]`;
      } else {
        const result = await sendWhatsAppText(phone, messageContent);
        waMessageId = result?.id || null;
      }
      msgStatus = "sent";
    } catch (sendErr: unknown) {
      console.error("Send message error:", sendErr);
      msgStatus = "failed";
      errorMessage = "فشل الإرسال";
    }

    // Save message to DB
    const { data: message, error: msgErr } = await supabase
      .from("inbox_messages")
      .insert({
        conversation_id: convId,
        direction: "outbound",
        sender_type: "agent",
        sender_name: "موظف",
        message_type: type,
        content: messageContent,
        media_url: media_url || null,
        template_name: template_name || null,
        template_params: template_params || null,
        reply_to_id: reply_to || null,
        whatsapp_message_id: waMessageId,
        status: msgStatus,
        error_message: errorMessage,
      } as any)
      .select("*")
      .single();

    if (msgErr) {
      console.error("Save message error:", msgErr);
    }

    // Update conversation
    const { error: convErr } = await supabase
      .from("inbox_conversations")
      .update({
        last_message_text: messageContent.slice(0, 200),
        last_message_at: new Date().toISOString(),
        last_message_direction: "outbound",
        status: "active",
      } as any)
      .eq("id", convId);

    if (convErr) {
      console.error("Update conversation error:", convErr);
    }

    // Update template usage count
    if (type === "template" && template_name) {
      await supabase.rpc("increment_template_usage", { tname: template_name }).catch(() => {});
    }

    if (msgStatus === "sent") {
      return apiSuccess({ message });
    }
    return apiError(errorMessage || "فشل الإرسال", 500);
  } catch (err: unknown) {
    console.error("Send error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
