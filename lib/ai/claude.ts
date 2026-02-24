// =====================================================
// ClalMobile — Shared Claude AI Client (DRY)
// All AI calls go through callClaude()
// =====================================================

export interface ClaudeRequest {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number; // default: 500
  temperature?: number; // default: 0.7
  jsonMode?: boolean; // if true → appends "أجب بـ JSON فقط" to system prompt
  timeout?: number; // ms, default: 15000
  apiKey?: string; // override — pass specific key per feature
}

export interface ClaudeResponse {
  text: string;
  json?: Record<string, unknown>; // parsed if jsonMode
  tokens: { input: number; output: number };
  duration: number; // ms
}

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse | null> {
  const apiKey = req.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[AI] No Anthropic API key provided");
    return null;
  }

  const start = Date.now();

  try {
    let systemPrompt = req.systemPrompt;
    if (req.jsonMode) {
      systemPrompt += "\n\nأجب بـ JSON فقط بدون أي نص إضافي أو markdown.";
    }

    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: req.maxTokens || 500,
        temperature: req.temperature ?? 0.7,
        system: systemPrompt,
        messages: req.messages,
      }),
      signal: AbortSignal.timeout(req.timeout || 15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[AI] Claude error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const duration = Date.now() - start;

    // Token tracking
    const tokens = {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0,
    };

    console.log(`[AI] Claude: ${tokens.input}+${tokens.output} tokens, ${duration}ms`);

    // Parse JSON if requested
    let json: Record<string, unknown> | undefined;
    if (req.jsonMode) {
      try {
        const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
        json = JSON.parse(cleaned);
      } catch {
        console.warn("[AI] JSON parse failed, returning raw text");
      }
    }

    return { text, json, tokens, duration };
  } catch (error) {
    console.error("[AI] Claude request failed:", error);
    return null;
  }
}

/** Ensure messages alternate user/assistant (Claude requirement) */
export function cleanAlternatingMessages(
  messages: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  if (messages.length === 0) return [{ role: "user", content: "مرحبا" }];

  const cleaned: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of messages) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === msg.role) {
      last.content += "\n" + msg.content;
    } else {
      cleaned.push({ ...msg });
    }
  }

  if (cleaned[0]?.role === "assistant") {
    cleaned.unshift({ role: "user", content: "مرحبا" });
  }

  if (cleaned[cleaned.length - 1]?.role === "assistant") {
    cleaned.push({ role: "user", content: "..." });
  }

  return cleaned;
}
