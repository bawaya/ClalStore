export const runtime = 'edge';

// =====================================================
// ClalMobile — WebChat API (Season 5)
// POST: Process chat message via new engine
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { BUSINESS } from "@/lib/constants";
import { handleWebChatMessage, formatWebChatResponse } from "@/lib/bot/webchat";
import { logBotInteraction } from "@/lib/bot/engine";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const sid = sessionId || `anon_${Date.now()}`;
    const response = await handleWebChatMessage(message, sid);
    const formatted = formatWebChatResponse(response);

    // Legacy log
    await logBotInteraction("webchat", sid, message, response.text, "processed");

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { text: `عذراً حصل خطأ. حاول مرة ثانية أو تواصل معنا:\n📞 ${BUSINESS.phone}`, quickReplies: [], escalate: false },
      { status: 200 }
    );
  }
}
