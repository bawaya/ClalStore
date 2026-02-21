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
) {
  try {
    const sb = createAdminSupabase();

    // Normalize phone for consistent matching
    const phone = normalizePhone(rawPhone).replace(/^\+/, "");
    // Also try with + prefix for older records
    const phoneWithPlus = "+" + phone;

    // Find or create conversation — try both phone formats
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

    let convId: string;

    if (existing) {
      convId = existing.id;
      const currentUnread = (existing as any).unread_count || 0;
      // Update conversation — increment unread manually (no RPC needed)
      const updateData: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        last_message_text: inboundText.substring(0, 200),
        last_message_direction: "inbound",
        unread_count: currentUnread + 1,
      };
      // Update customer name if we have one from WhatsApp and it's real
      if (customerName && customerName.trim().length > 1) {
        updateData.customer_name = customerName.trim();
      }
      await sb
        .from("inbox_conversations")
        .update(updateData as any)
        .eq("id", convId);
    } else {
      // Create new conversation
      const { data: newConv } = await sb
        .from("inbox_conversations")
        .insert({
          customer_phone: phone,
          customer_name: customerName?.trim() || null,
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
