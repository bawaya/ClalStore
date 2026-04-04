// =====================================================
// ClalMobile — Shared Gemini AI Client
// All Gemini calls go through callGemini()
// =====================================================

import type { ClaudeRequest, ClaudeResponse } from "./claude";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-1.5-flash"; 

export async function callGemini(req: ClaudeRequest): Promise<ClaudeResponse | null> {
  const apiKey = req.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[AI] No Gemini API key provided");
    return null;
  }

  const start = Date.now();
  let systemPrompt = req.systemPrompt;
  if (req.jsonMode) {
    systemPrompt += "\n\nأجب بـ JSON فقط بدون أي نص إضافي أو markdown.";
  }

  // Convert messages to Gemini format
  const contents = req.messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  try {
    const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens || 500,
        }
      }),
      signal: AbortSignal.timeout(req.timeout || 15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[AI] Gemini error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const duration = Date.now() - start;

    const tokens = {
      input: data.usageMetadata?.promptTokenCount || 0,
      output: data.usageMetadata?.candidatesTokenCount || 0,
    };

    console.log(`[AI] Gemini: ${tokens.input}+${tokens.output} tokens, ${duration}ms`);

    let json: Record<string, unknown> | undefined;
    if (req.jsonMode && text) {
      try {
        const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
        json = JSON.parse(cleaned);
      } catch {
        console.warn("[AI] JSON parse failed");
      }
    }

    return { text, json, tokens, duration };
  } catch (err) {
    console.error("[AI] Gemini request failed:", err);
    return null;
  }
}
