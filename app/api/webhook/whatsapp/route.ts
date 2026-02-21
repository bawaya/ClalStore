export const runtime = 'edge';

// =====================================================
// ClalMobile — WhatsApp Webhook (Season 5)
// POST: Receive from yCloud → new engine → save to inbox
// GET: Webhook verification
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { parseWebhook, handleWhatsAppMessage, sendBotResponse } from "@/lib/bot/whatsapp";
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
  phone: string,
  customerName: string | undefined,
  inboundText: string,
  inboundMsgId: string | undefined,
  botReplyText: string | null,
) {
  try {
    const sb = createAdminSupabase();

    // Find or create conversation
    const { data: existing } = await sb
      .from("inbox_conversations")
      .select("id")
      .eq("customer_phone", phone)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let convId: string;

    if (existing) {
      convId = existing.id;
      // Update conversation
      await sb
        .from("inbox_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: inboundText.substring(0, 200),
          last_message_direction: "inbound",
          unread_count: (sb.rpc as any)("increment_unread", { row_id: convId }) || 1,
        } as any)
        .eq("id", convId);

      // Increment unread separately (safer)
      await sb.rpc("increment_unread" as any, { row_id: convId }).catch(() => {
        // Fallback: just update with raw SQL-style
        sb.from("inbox_conversations")
          .update({ unread_count: 1 } as any)
          .eq("id", convId);
      });
    } else {
      // Create new conversation
      const { data: newConv } = await sb
        .from("inbox_conversations")
        .insert({
          customer_phone: phone,
          customer_name: customerName || null,
          status: "bot",
          last_message_at: new Date().toISOString(),
          last_message_text: inboundText.substring(0, 200),
          last_message_direction: "inbound",
          unread_count: 1,
        } as any)
        .select("id")
        .single();

      convId = newConv?.id;
      if (!convId) return;
    }

    // Save inbound message
    await sb.from("inbox_messages").insert({
      conversation_id: convId,
      direction: "inbound",
      sender_type: "customer",
      message_type: "text",
      content: inboundText,
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

      // Update last message to bot reply
      await sb
        .from("inbox_conversations")
        .update({
          last_message_text: botReplyText.substring(0, 200),
          last_message_direction: "outbound",
        } as any)
        .eq("id", convId);
    }
  } catch (err) {
    console.error("saveToInbox error:", err);
  }
}

// Receive messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Parse incoming message
    const msg = parseWebhook(body);
    if (!msg || !msg.text) {
      return NextResponse.json({ received: true });
    }

    // Process through new engine
    const response = await handleWhatsAppMessage(msg);

    // Send reply via WhatsApp (if there's a response)
    if (response.text) {
      await sendBotResponse(msg.from, response);
    }

    // Save to inbox tables (customer message + bot reply)
    await saveToInbox(
      msg.from,
      msg.name,
      msg.text,
      msg.messageId,
      response.text || null,
    );

    // Legacy log
    if (response.text) {
      await logBotInteraction("whatsapp", msg.from, msg.text, response.text, "processed");
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
