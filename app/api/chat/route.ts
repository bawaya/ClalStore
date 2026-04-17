
// =====================================================
// ClalMobile — WebChat API (Season 5)
// POST: Process chat message via new engine
// =====================================================

import { NextRequest } from "next/server";
import { handleWebChatMessage, formatWebChatResponse } from "@/lib/bot/webchat";
import { logBotInteraction } from "@/lib/bot/engine";
import { apiSuccess, apiError } from "@/lib/api-response";
import { chatSchema, validateBody } from "@/lib/admin/validators";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const validation = validateBody(raw, chatSchema);
    if (validation.error) {
      return apiError("Message required", 400);
    }
    const { message, sessionId } = validation.data!;

    const sid = sessionId || `anon_${Date.now()}`;
    const response = await handleWebChatMessage(message, sid);
    const formatted = formatWebChatResponse(response);

    // Legacy log
    await logBotInteraction("webchat", sid, message, response.text, "processed");

    return apiSuccess(formatted);
  } catch (err: unknown) {
    console.error("Chat API error:", err);
    return apiSuccess({
      text: "عذراً حصل خطأ. حاول مرة ثانية أو تواصل معنا:\n📞 053-3337653",
      quickReplies: [],
      escalate: false,
    });
  }
}
