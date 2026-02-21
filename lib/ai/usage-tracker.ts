// =====================================================
// ClalMobile — AI Usage Tracker (Cost Tracking)
// Fire-and-forget — never blocks the response
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

export type AIFeature =
  | "bot_reply"
  | "smart_reply"
  | "summary"
  | "sentiment"
  | "smart_search";

interface UsageData {
  feature: AIFeature;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  conversationId?: string;
}

/** Track AI usage — fire-and-forget, never awaited */
export function trackAIUsage(data: UsageData): void {
  // Don't block — run in background
  _saveUsage(data).catch((err) => {
    console.warn("[AI Usage] Failed to track:", err);
  });
}

async function _saveUsage(data: UsageData): Promise<void> {
  try {
    const s = createAdminSupabase();
    if (!s) return;

    await s.from("ai_usage").insert({
      feature: data.feature,
      input_tokens: data.inputTokens,
      output_tokens: data.outputTokens,
      duration_ms: data.durationMs,
      model: "claude-sonnet-4-20250514",
      conversation_id: data.conversationId || null,
    });
  } catch {
    // Silent fail — cost tracking should never break app
  }
}

/** Get monthly AI usage stats */
export async function getAIUsageStats(): Promise<{
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  byFeature: Record<string, { requests: number; tokens: number }>;
} | null> {
  try {
    const s = createAdminSupabase();
    if (!s) return null;

    // Get this month's data
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await s
      .from("ai_usage")
      .select("feature, input_tokens, output_tokens")
      .gte("created_at", startOfMonth.toISOString());

    if (error || !data) return null;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const byFeature: Record<string, { requests: number; tokens: number }> = {};

    for (const row of data) {
      const inp = row.input_tokens || 0;
      const out = row.output_tokens || 0;
      totalInputTokens += inp;
      totalOutputTokens += out;

      const f = row.feature || "unknown";
      if (!byFeature[f]) byFeature[f] = { requests: 0, tokens: 0 };
      byFeature[f].requests += 1;
      byFeature[f].tokens += inp + out;
    }

    // Claude Sonnet pricing: $3/1M input, $15/1M output
    const estimatedCost =
      (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15;

    return {
      totalRequests: data.length,
      totalInputTokens,
      totalOutputTokens,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      byFeature,
    };
  } catch {
    return null;
  }
}
