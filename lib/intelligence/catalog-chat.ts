// =====================================================
// Catalog Chat — Tab 4
// "Ask your catalog" — Opus 4.7 (1M) sees full catalog and answers.
// Returns either prose or a JSON action proposal.
// =====================================================

import { callOpusWithRetry } from "./opus-client";
import { CHAT_SYSTEM } from "./prompts";
import { bulkActionSchema, type BulkAction } from "./schemas";
import { loadCatalogContext } from "./context-builder";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  /** Prose answer (Markdown allowed) — empty string if action plan was returned. */
  text: string;
  /** Action plan when the user asked to perform a bulk modification. */
  action: BulkAction | null;
  meta: { rows: number; tokens: { input: number; output: number; cacheRead: number } };
}

/**
 * Vercel Fluid Compute / Workers run up to 300s. Opus 4.7 handles the full
 * catalog comfortably with 1M context. We push the catalog into the system
 * block with cache:true so subsequent chat turns hit the prompt cache and
 * cost ~10% of the first call.
 */
const CHAT_SAMPLE_CAP = 1200;

export async function askCatalog(
  question: string,
  history: ChatTurn[] = [],
): Promise<ChatResult> {
  const ctx = await loadCatalogContext({ limit: CHAT_SAMPLE_CAP });

  const transcript = history
    .map((t) => `[${t.role.toUpperCase()}]\n${t.content}`)
    .join("\n\n");

  // Catalog is ~stable across a chat session — put it in a cached system
  // block so prompt caching makes follow-up questions cheap and fast.
  const catalogBlock =
    `# CATALOG (${ctx.totalRows} rows, JSONL — most recent first)\n` + ctx.jsonl;

  const userMessage =
    (transcript ? `# PRIOR TURNS\n${transcript}\n\n` : "") +
    `# CURRENT QUESTION\n${question}`;

  const res = await callOpusWithRetry(
    {
      system: [
        { type: "text", text: CHAT_SYSTEM, cache: true },
        { type: "text", text: catalogBlock, cache: true },
      ],
      user: userMessage,
      maxTokens: 3000,
    },
    1,
  );

  // If the response parses as a bulk_update action, surface it as action.
  let action: BulkAction | null = null;
  if (res.json && typeof res.json === "object" && (res.json as { action?: string }).action === "bulk_update") {
    const parsed = bulkActionSchema.safeParse(res.json);
    if (parsed.success) action = parsed.data;
  }

  return {
    text: action ? "" : res.text,
    action,
    meta: {
      rows: ctx.totalRows,
      tokens: {
        input: res.usage.input,
        output: res.usage.output,
        cacheRead: res.usage.cacheRead,
      },
    },
  };
}
