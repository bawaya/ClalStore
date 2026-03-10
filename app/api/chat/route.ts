export const runtime = 'edge';

// =====================================================
// ClalMobile — WebChat API (Season 5)
// POST: Process chat message via new engine
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { handleWebChatMessage, formatWebChatResponse } from "@/lib/bot/webchat";
import { logBotInteraction } from "@/lib/bot/engine";

const chatRateLimit = new Map<string, number[]>();
const CHAT_RATE_LIMIT = 15;
const CHAT_RATE_WINDOW = 60_000;

function checkChatRate(ip: string): boolean {
  const now = Date.now();
  const timestamps = chatRateLimit.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < CHAT_RATE_WINDOW);
  chatRateLimit.set(ip, recent);
  if (recent.length >= CHAT_RATE_LIMIT) return false;
  recent.push(now);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip") || "unknown";
    if (!checkChatRate(ip)) {
      return NextResponse.json({ text: "كثرة رسائل — حاول بعد دقيقة", quickReplies: [], escalate: false }, { status: 429 });
    }

    const { message, sessionId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    if (message.length > 1000) {
      return NextResponse.json({ error: "الرسالة طويلة جداً — الحد 1000 حرف" }, { status: 400 });
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
      { text: "عذراً حصل خطأ. حاول مرة ثانية أو تواصل معنا:\n📞 053-3337653", quickReplies: [], escalate: false },
      { status: 200 }
    );
  }
}
