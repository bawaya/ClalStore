export const runtime = 'edge';

// =====================================================
// ClalMobile — WhatsApp Webhook (Season 5)
// POST: Receive from yCloud → new engine → save to inbox
// GET: Webhook verification
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { parseWebhook, handleWhatsAppMessage, sendBotResponse, normalizePhone } from "@/lib/bot/whatsapp";
import { logBotInteraction } from "@/lib/bot/engine";
import { createAdminSupabase } from "@/lib/supabase";

// Webhook verification (yCloud sends GET to verify)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || searchParams.get("hub.verify_token");
  const challenge = searchParams.get("challenge") || searchParams.get("hub.challenge");

  if (token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge || "OK", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid token" }, { status: 403 });
}

/* ── Save incoming + bot reply to inbox tables ── */
async function saveToInbox(
  rawPhone: string,
  customerName: string | undefined,
  inboundText: string,
  inboundMsgId: string | undefined,
  botReplyText: string | null,
  media?: {
    type: "image" | "document" | "audio" | "video";
    url?: string;
    filename?: string;
    mimeType?: string;
  },
) {
  try {
    const sb = createAdminSupabase();

    const phone = normalizePhone(rawPhone).replace(/^\+/, "");
    const phoneWithPlus = "+" + phone;

    let existing: { id: string; unread_count?: number } | null = null;
    for (const ph of [phone, phoneWithPlus, rawPhone]) {
      const { data } = await sb
        .from("inbox_conversations")
        .select("id, unread_count")
        .eq("customer_phone", ph)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data) { existing = data as any; break; }
    }

    const displayText = inboundText
      || (media?.type === "image" ? "📷 صورة" : "")
      || (media?.type === "document" ? "📄 مستند" : "")
      || (media?.type === "audio" ? "🎤 رسالة صوتية" : "")
      || (media?.type === "video" ? "🎥 فيديو" : "")
      || "";

    let convId: string;

    if (existing) {
      convId = existing.id;
      const currentUnread = (existing as any).unread_count || 0;
      const updateData: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        last_message_text: displayText.substring(0, 200),
        last_message_direction: "inbound",
        unread_count: currentUnread + 1,
      };
      if (customerName && customerName.trim().length > 1) {
        updateData.customer_name = customerName.trim();
      }
      await sb
        .from("inbox_conversations")
        .update(updateData as any)
        .eq("id", convId);
    } else {
      const { data: newConv } = await sb
        .from("inbox_conversations")
        .insert({
          customer_phone: phone,
          customer_name: customerName?.trim() || null,
          status: "bot",
          last_message_at: new Date().toISOString(),
          last_message_text: displayText.substring(0, 200),
          last_message_direction: "inbound",
          unread_count: 1,
        } as any)
        .select("id")
        .single();

      convId = newConv?.id;
      if (!convId) return;
    }

    // Save inbound message (text or media)
    await sb.from("inbox_messages").insert({
      conversation_id: convId,
      direction: "inbound",
      sender_type: "customer",
      message_type: media?.type || "text",
      content: inboundText || null,
      media_url: media?.url || null,
      media_filename: media?.filename || null,
      media_mime_type: media?.mimeType || null,
      whatsapp_message_id: inboundMsgId || null,
      status: "delivered",
    } as any);

    // Save bot reply
    if (botReplyText) {
      await sb.from("inbox_messages").insert({
        conversation_id: convId,
        direction: "outbound",
        sender_type: "bot",
        message_type: "text",
        content: botReplyText,
        status: "sent",
      } as any);

      await sb
        .from("inbox_conversations")
        .update({
          last_message_text: botReplyText.substring(0, 200),
          last_message_direction: "outbound",
        } as any)
        .eq("id", convId);
    }

    return convId;
  } catch (err) {
    console.error("saveToInbox error:", err);
  }
}

// Receive messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const msg = parseWebhook(body);
    if (!msg) {
      return NextResponse.json({ received: true });
    }

    const isMedia = ["image", "document", "audio", "video"].includes(msg.type);
    const hasText = !!(msg.text && msg.text.trim());

    // Skip completely empty messages
    if (!hasText && !isMedia) {
      return NextResponse.json({ received: true });
    }

    // For text/button messages or media with caption, process through bot
    let response = { text: "" } as { text: string; quickReplies?: string[] };
    if (hasText) {
      response = await handleWhatsAppMessage(msg);
    } else if (isMedia) {
      // Media without caption — acknowledge receipt
      const { getTemplate } = await import("@/lib/bot/templates");
      response.text = await getTemplate("media_received", "ar") ||
        "شكراً على الرسالة! 📎 كيف بقدر أساعدك؟";
    }

    if (response.text) {
      await sendBotResponse(msg.from, response);
    }

    // Save to inbox (with media info if applicable)
    const mediaInfo = isMedia ? {
      type: msg.type as "image" | "document" | "audio" | "video",
      url: msg.mediaUrl,
      filename: msg.mediaFilename,
      mimeType: msg.mediaMimeType,
    } : undefined;

    await saveToInbox(
      msg.from,
      msg.name,
      msg.text || "",
      msg.messageId,
      response.text || null,
      mediaInfo,
    );

    // Notify admin for new conversations or high-priority messages
    const { notifyAdminNewMessage } = await import("@/lib/bot/admin-notify");
    await notifyAdminNewMessage({
      phone: msg.from,
      name: msg.name || "",
      preview: msg.text || (isMedia ? `[${msg.type}]` : ""),
      isMedia,
    }).catch(() => {});

    // Legacy log
    if (hasText && response.text) {
      await logBotInteraction("whatsapp", msg.from, msg.text || "", response.text, "processed");
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
