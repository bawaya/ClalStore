import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";
import { callClaude, type ClaudeRequest, type ClaudeResponse } from "@/lib/ai/claude";
import { callGemini } from "@/lib/ai/gemini";

export type AIProvider = "Anthropic Claude" | "Google Gemini";
export type AIConfigScope = "admin" | "bot" | "store";

export interface AIRuntimeConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  source: "integration" | "env";
}

export interface ConfiguredAIResponse extends ClaudeResponse {
  provider: AIProvider;
  model: string;
  source: "integration" | "env";
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  "Anthropic Claude": "claude-sonnet-4-20250514",
  "Google Gemini": "gemini-1.5-flash-latest",
};

function getGeminiEnvKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
}

function getAnthropicEnvKey(scope: AIConfigScope): string {
  if (scope === "store") {
    return (process.env.ANTHROPIC_API_KEY_STORE || process.env.ANTHROPIC_API_KEY || "").trim();
  }

  if (scope === "bot") {
    return (process.env.ANTHROPIC_API_KEY_BOT || process.env.ANTHROPIC_API_KEY || "").trim();
  }

  return (process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || "").trim();
}

function getEnvRuntime(scope: AIConfigScope): AIRuntimeConfig | null {
  const anthropicKey = getAnthropicEnvKey(scope);
  if (anthropicKey) {
    return {
      provider: "Anthropic Claude",
      apiKey: anthropicKey,
      model: DEFAULT_MODELS["Anthropic Claude"],
      source: "env",
    };
  }

  const geminiKey = getGeminiEnvKey();
  if (geminiKey) {
    return {
      provider: "Google Gemini",
      apiKey: geminiKey,
      model: DEFAULT_MODELS["Google Gemini"],
      source: "env",
    };
  }

  return null;
}

export async function getConfiguredAIRuntime(
  scope: AIConfigScope = "admin"
): Promise<AIRuntimeConfig | null> {
  try {
    const { integration, config } = await getIntegrationByTypeWithSecrets("ai_chat");
    const isActive = integration?.status === "active";
    const provider =
      integration?.provider === "Google Gemini"
        ? "Google Gemini"
        : integration?.provider === "Anthropic Claude"
          ? "Anthropic Claude"
          : null;

    if (isActive && provider) {
      const envKey = provider === "Google Gemini" ? getGeminiEnvKey() : getAnthropicEnvKey(scope);
      const apiKey = String(config.api_key || envKey).trim();

      if (apiKey) {
        return {
          provider,
          apiKey,
          model: String(config.model || DEFAULT_MODELS[provider]).trim(),
          source: "integration",
        };
      }
    }
  } catch (error) {
    console.error("Failed to resolve configured AI integration:", error);
  }

  return getEnvRuntime(scope);
}

export async function callConfiguredAI(
  req: ClaudeRequest,
  scope: AIConfigScope = "admin"
): Promise<ConfiguredAIResponse | null> {
  const runtime = await getConfiguredAIRuntime(scope);
  if (!runtime) {
    return null;
  }

  const payload: ClaudeRequest = {
    ...req,
    apiKey: runtime.apiKey,
    model: req.model || runtime.model,
  };

  const result =
    runtime.provider === "Google Gemini"
      ? await callGemini(payload)
      : await callClaude(payload);

  if (!result) {
    return null;
  }

  return {
    ...result,
    provider: runtime.provider,
    model: payload.model || runtime.model,
    source: runtime.source,
  };
}
