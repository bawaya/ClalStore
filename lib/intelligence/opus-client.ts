// =====================================================
// Opus 4.7 (1M context) — Catalog Intelligence Client
// Wraps the Anthropic API for the /admin/intelligence tools.
// Adds: 1M context beta, prompt caching, JSON-strict parsing.
// =====================================================

import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const OPUS_MODEL = "claude-opus-4-7";

export interface OpusBlock {
  type: "text";
  text: string;
  /** Marks the block as cacheable (Anthropic returns a cache_control hit/miss). */
  cache?: boolean;
}

export interface OpusRequest {
  /** Static system content — large, reusable, cached automatically. */
  system: OpusBlock[];
  /** Per-call user message. */
  user: string;
  /** Hard limit on output tokens. Opus is verbose — set tight per task. */
  maxTokens?: number;
  /** Defaults to 0 (deterministic). */
  temperature?: number;
  /** Override the API key (for multi-tenant). */
  apiKey?: string;
}

export interface OpusResponse {
  text: string;
  json: unknown;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  durationMs: number;
}

export class OpusError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "OpusError";
  }
}

async function resolveApiKey(override?: string): Promise<string> {
  if (override) return override;
  // Prefer the dedicated ai_intelligence integration row; fall back to ai_chat
  // when it's been switched to Anthropic Claude.
  for (const type of ["ai_intelligence", "ai_chat"]) {
    try {
      const { integration, config } = await getIntegrationByTypeWithSecrets(type);
      const provider = String(integration?.provider || config?.provider || "").toLowerCase();
      if (config?.api_key && provider.includes("claude")) {
        return String(config.api_key).trim();
      }
    } catch {
      // try next source
    }
  }
  return (
    process.env.ANTHROPIC_API_KEY_ADMIN ||
    process.env.ANTHROPIC_API_KEY ||
    ""
  ).trim();
}

/**
 * Calls Opus 4.7 with 1M context + prompt caching enabled.
 * Cacheable system blocks must be marked `cache: true`.
 */
export async function callOpus(req: OpusRequest): Promise<OpusResponse> {
  const apiKey = await resolveApiKey(req.apiKey);
  if (!apiKey) {
    throw new OpusError("Anthropic API key not configured", 401, false);
  }

  const start = Date.now();

  const systemPayload = req.system.map((b) => ({
    type: "text" as const,
    text: b.text,
    ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  // Opus 4.7 deprecates the `temperature` parameter — only send it for older
  // models that still accept it.
  const body: Record<string, unknown> = {
    model: OPUS_MODEL,
    max_tokens: req.maxTokens ?? 4096,
    system: systemPayload,
    messages: [{ role: "user" as const, content: req.user }],
  };
  if (req.temperature != null && !OPUS_MODEL.startsWith("claude-opus-4-7")) {
    body.temperature = req.temperature;
  }

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // 1M-context beta — required for Opus 4.7 to address contexts > 200k.
      "anthropic-beta": "context-1m-2025-08-07,prompt-caching-2024-07-31",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new OpusError(
      `Opus API ${res.status}: ${errBody.slice(0, 400)}`,
      res.status,
      retryable,
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text: string }[];
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  const text = (data.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  const json = parseJsonSafe(text);

  return {
    text,
    json,
    usage: {
      input: data.usage?.input_tokens ?? 0,
      output: data.usage?.output_tokens ?? 0,
      cacheRead: data.usage?.cache_read_input_tokens ?? 0,
      cacheWrite: data.usage?.cache_creation_input_tokens ?? 0,
    },
    durationMs: Date.now() - start,
  };
}

/**
 * Robust JSON extraction. Handles ```json fences, leading prose, trailing notes.
 * Returns null if no JSON object/array can be located.
 */
function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  // Strip code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Locate first { or [ and matching last } or ]
    const firstObj = cleaned.indexOf("{");
    const firstArr = cleaned.indexOf("[");
    const start =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
    if (start === -1) return null;

    const open = cleaned[start];
    const close = open === "{" ? "}" : "]";
    const end = cleaned.lastIndexOf(close);
    if (end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Retries Opus calls on 429/5xx with exponential backoff. */
export async function callOpusWithRetry(
  req: OpusRequest,
  maxAttempts = 3,
): Promise<OpusResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callOpus(req);
    } catch (err) {
      lastError = err;
      if (!(err instanceof OpusError) || !err.retryable || attempt === maxAttempts) {
        throw err;
      }
      const delay = 500 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
