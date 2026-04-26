import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";

export type AdminOpenAIScope = "general" | "pricing";

export interface AdminOpenAIRuntime {
  apiKey: string;
  model: string;
  source: "integration" | "env";
}

const DEFAULT_GENERAL_MODEL = "gpt-4o-mini";
const DEFAULT_PRICING_MODEL = "gpt-4o-mini";

function getEnvOpenAIKey(scope: AdminOpenAIScope): string {
  if (scope === "pricing") {
    return (
      process.env.OPENAI_API_KEY_PRICES ||
      process.env.OPENAI_API_KEY_ADMIN ||
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();
  }

  return (process.env.OPENAI_API_KEY_ADMIN || process.env.OPENAI_API_KEY || "").trim();
}

export async function getAdminOpenAIRuntime(
  scope: AdminOpenAIScope = "general"
): Promise<AdminOpenAIRuntime | null> {
  try {
    const { integration, config } = await getIntegrationByTypeWithSecrets("ai_admin");
    if (integration?.status === "active" && (!integration.provider || integration.provider === "OpenAI")) {
      const apiKey = String(
        scope === "pricing"
          ? config.pricing_api_key || config.api_key || getEnvOpenAIKey("pricing")
          : config.api_key || getEnvOpenAIKey("general")
      ).trim();

      if (apiKey) {
        const model = String(
          scope === "pricing"
            ? config.pricing_model || config.model || DEFAULT_PRICING_MODEL
            : config.model || DEFAULT_GENERAL_MODEL
        ).trim();

        return {
          apiKey,
          model,
          source: "integration",
        };
      }
    }
  } catch (error) {
    console.error("Failed to resolve admin OpenAI integration:", error);
  }

  const envApiKey = getEnvOpenAIKey(scope);
  if (!envApiKey) {
    return null;
  }

  return {
    apiKey: envApiKey,
    model: scope === "pricing" ? DEFAULT_PRICING_MODEL : DEFAULT_GENERAL_MODEL,
    source: "env",
  };
}
