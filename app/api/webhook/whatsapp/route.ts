// =====================================================
// ClalMobile — WhatsApp Webhook (Season 5)
// POST: Receive from yCloud → new engine
// GET: Webhook verification
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { parseWebhook, handleWhatsAppMessage, sendBotResponse } from "@/lib/bot/whatsapp";
import { logBotInteraction } from "@/lib/bot/engine";

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
    if (!response.text) {
      return NextResponse.json({ received: true });
    }

    // Send reply via WhatsApp
    await sendBotResponse(msg.from, response);

    // Legacy log
    await logBotInteraction("whatsapp", msg.from, msg.text, response.text, "processed");

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
