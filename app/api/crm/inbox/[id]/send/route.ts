export const runtime = 'edge';

// =====================================================
// ClalMobile — Send Message via Inbox
// POST /api/crm/inbox/[id]/send
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { sendWhatsAppText, sendWhatsAppImage, sendWhatsAppDocument } from "@/lib/bot/whatsapp";
import { requireAdmin } from "@/lib/admin/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const convId = params.id;
    const body = await req.json();
    const { type = "text", content, template_name, template_params, media_url, reply_to } = body;

    if (media_url) {
      try {
        const parsed = new URL(media_url);
        const allowedHosts = [".supabase.co", ".cloudinary.com", ".r2.cloudflarestorage.com", "clalmobile.com"];
        const isAllowed = allowedHosts.some((h) => parsed.hostname.endsWith(h));
        if (!isAllowed || !["https:", "http:"].includes(parsed.protocol)) {
          return NextResponse.json({ success: false, error: "عنوان الملف غير مسموح" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ success: false, error: "رابط غير صالح" }, { status: 400 });
      }
    }

    // Get conversation
    const { data: conv } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", convId)
      .single();

    if (!conv) {
      return NextResponse.json({ success: false, error: "المحادثة غير موجودة" }, { status: 404 });
    }

    if ((conv as any).is_blocked) {
      return NextResponse.json({ success: false, error: "هذا العميل محظور" }, { status: 403 });
    }

    // Check 24-hour window for non-template messages
    if (type !== "template") {
      const lastInbound = (conv as any).last_message_at;
      if (lastInbound && (conv as any).last_message_direction === "inbound") {
        const hoursSince = (Date.now() - new Date(lastInbound).getTime()) / (1000 * 60 * 60);
        if (hoursSince > 24) {
          return NextResponse.json({
            success: false,
            error: "مر 24 ساعة — يمكنك فقط إرسال قالب معتمد",
            require_template: true,
          }, { status: 400 });
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
    } catch (sendErr: any) {
      console.error("Send message error:", sendErr);
      msgStatus = "failed";
      errorMessage = sendErr?.message || "فشل الإرسال";
    }

    // Save message to DB
    const { data: message, error: msgErr } = await supabase
      .from("inbox_messages")
      .insert({
        conversation_id: convId,
        direction: "outbound",
        sender_type: "agent",
        sender_name: auth.email?.split("@")[0] || "موظف",
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
    await supabase
      .from("inbox_conversations")
      .update({
        last_message_text: messageContent.slice(0, 200),
        last_message_at: new Date().toISOString(),
        last_message_direction: "outbound",
        status: "active",
      } as any)
      .eq("id", convId);

    // Update template usage count
    if (type === "template" && template_name) {
      await supabase.rpc("increment_template_usage", { tname: template_name }).catch(() => {});
    }

    return NextResponse.json({
      success: msgStatus === "sent",
      message,
      error: errorMessage,
    });
  } catch (err: any) {
    console.error("Send error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
