// =====================================================
// Vercel AI Gateway client — for vision-AI features
// Mirrors the opus-client pattern but routes through the
// gateway so we get failover, observability, and per-tag
// cost tracking without coupling to a single provider.
// =====================================================
//
// Resolves API key from (in order):
//   1. explicit override (req.apiKey)
//   2. ai_vision integration row (admin-configured)
//   3. AI_GATEWAY_API_KEY env var
//   4. VERCEL_OIDC_TOKEN env var (for Vercel deployments)

import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";

const GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1/ai";

export interface VisionImageBlock {
  type: "image";
  /** Either a remote URL or a base64 data URL. */
  url: string;
}

export interface VisionTextBlock {
  type: "text";
  text: string;
}

export type VisionUserBlock = VisionImageBlock | VisionTextBlock;

export interface GatewayRequest {
  /** Model slug as the Gateway accepts it (e.g., "google/gemini-2.5-flash"). */
  model: string;
  /** System prompt — kept simple. The Gateway path doesn't use Anthropic's
   *  cache_control format, but it caches identical request bodies via
   *  the `cacheControl` provider option. */
  system?: string;
  /** Multi-modal user blocks (text + images). */
  user: VisionUserBlock[];
  maxTokens?: number;
  temperature?: number;
  /** Tags propagate to the Gateway dashboard for cost-by-feature tracking. */
  tags?: string[];
  /** Per-user attribution for rate limiting. */
  user_id?: string;
  /** "max-age=3600" caches identical requests for 1h. */
  cacheControl?: string;
  apiKey?: string;
  /** Fallback model chain — used if primary fails. */
  fallbackModels?: string[];
}

export interface GatewayResponse<T = unknown> {
  text: string;
  json: T | null;
  usage: { input: number; output: number; total: number };
  model_used: string;
  durationMs: number;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

async function resolveApiKey(override?: string): Promise<string> {
  if (override) return override;

  try {
    const { config } = await getIntegrationByTypeWithSecrets("ai_vision");
    if (config?.api_key) return String(config.api_key).trim();
  } catch {
    // fall through
  }

  return (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    ""
  ).trim();
}

/**
 * Calls the Vercel AI Gateway via the AI SDK Gateway protocol.
 * We use the chat completions shape since it's universally supported
 * across all gateway-routable models (Claude, Gemini, GPT, etc.).
 */
export async function callGateway<T = unknown>(
  req: GatewayRequest,
): Promise<GatewayResponse<T>> {
  const apiKey = await resolveApiKey(req.apiKey);
  if (!apiKey) {
    throw new GatewayError(
      "AI Gateway API key not configured (set ai_vision integration or AI_GATEWAY_API_KEY)",
      401,
      false,
    );
  }

  const start = Date.now();
  const modelChain = [req.model, ...(req.fallbackModels ?? [])];
  let lastError: GatewayError | null = null;

  for (const model of modelChain) {
    try {
      const result = await callOnce<T>(model, req, apiKey);
      return { ...result, durationMs: Date.now() - start };
    } catch (err) {
      lastError = err as GatewayError;
      if (err instanceof GatewayError && !err.retryable && err.status !== 503) {
        throw err;
      }
      // try next model in chain
    }
  }

  throw lastError ?? new GatewayError("All models in chain failed", 500, false);
}

async function callOnce<T>(
  model: string,
  req: GatewayRequest,
  apiKey: string,
): Promise<Omit<GatewayResponse<T>, "durationMs">> {
  const messages: Array<{ role: string; content: unknown }> = [];
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }

  // Convert our compact block shape into the OpenAI-compatible content array
  // that the Gateway accepts for vision models.
  const userContent = req.user.map((block) =>
    block.type === "text"
      ? { type: "text", text: block.text }
      : { type: "image_url", image_url: { url: block.url } },
  );
  messages.push({ role: "user", content: userContent });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (req.cacheControl) headers["cache-control"] = req.cacheControl;
  if (req.tags && req.tags.length > 0) {
    headers["x-ai-gateway-tags"] = req.tags.join(",");
  }
  if (req.user_id) {
    headers["x-ai-gateway-user"] = req.user_id;
  }

  const body = {
    model,
    messages,
    max_tokens: req.maxTokens ?? 2000,
    ...(req.temperature != null ? { temperature: req.temperature } : {}),
  };

  const res = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new GatewayError(
      `Gateway ${res.status} (${model}): ${errBody.slice(0, 400)}`,
      res.status,
      retryable,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const text = data.choices?.[0]?.message?.content?.trim() || "";
  const json = parseJsonSafe(text) as T | null;

  return {
    text,
    json,
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    },
    model_used: model,
  };
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf("{");
    const firstArr = cleaned.indexOf("[");
    const start =
      firstObj === -1
        ? firstArr
        : firstArr === -1
          ? firstObj
          : Math.min(firstObj, firstArr);
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

// ────────────────────────────────────────────────
// Recommended models (override via integration config when needed)
// ────────────────────────────────────────────────

/** Vision-capable, fast, cheap — ideal for image curation/audit tasks. */
export const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";
/** Fallback if primary is rate-limited or down. */
export const FALLBACK_VISION_MODEL = "anthropic/claude-haiku-4.5";
