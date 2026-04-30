// =====================================================
// Catalog Health auditor — Tab 2
// Sends entire catalog to Opus 4.7 (1M) and gets a structured report.
// =====================================================

import { callOpusWithRetry } from "./opus-client";
import { HEALTH_SYSTEM, BRAND_CANON_BLOCK, buildTaxonomyBlock } from "./prompts";
import { healthReportSchema, type HealthReport } from "./schemas";
import { loadCatalogContext } from "./context-builder";

/**
 * Vercel Fluid Compute / Workers run up to 300s. Opus 4.7 with 1M context
 * comfortably ingests the full catalog (~1000 rows of compact JSONL).
 * Auditing more rows finds far more real issues — the cost is one extra
 * pass through the cached system prompts, not user latency.
 */
const HEALTH_SAMPLE_CAP = 1000;

export async function runHealthCheck(): Promise<{
  report: HealthReport;
  meta: { rows: number; tokens: { input: number; output: number; cacheRead: number } };
}> {
  const ctx = await loadCatalogContext({ limit: HEALTH_SAMPLE_CAP });
  if (ctx.totalRows === 0) {
    throw new Error("No products in catalog");
  }

  const taxonomy = buildTaxonomyBlock();

  const res = await callOpusWithRetry(
    {
      system: [
        { type: "text", text: HEALTH_SYSTEM, cache: true },
        { type: "text", text: BRAND_CANON_BLOCK, cache: true },
        { type: "text", text: taxonomy, cache: true },
      ],
      user:
        `# CATALOG SAMPLE (${ctx.totalRows} rows, JSONL — most recent first)\n` +
        ctx.jsonl +
        `\n\n# TASK\nProduce the strict health JSON report defined in your instructions.\n` +
        `Keep each list under 30 items — prioritise the highest-impact issues only.\n` +
        `Be concise: omit verbose reasons, use short phrases.`,
      maxTokens: 12000,
    },
    1,
  );

  const parsed = healthReportSchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Opus health report shape invalid: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  return {
    report: parsed.data,
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
