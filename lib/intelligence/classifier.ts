// =====================================================
// Classifier — Tab 1
// Classifies one or more products via Opus 4.7.
// =====================================================

import { callOpusWithRetry } from "./opus-client";
import { CLASSIFIER_SYSTEM, BRAND_CANON_BLOCK, buildTaxonomyBlock } from "./prompts";
import { classificationArraySchema, type ClassificationItem } from "./schemas";

export interface ClassifyInput {
  /** Product id (optional, only used for traceability in the response). */
  id?: string;
  /** Free-form product name — Hebrew/Arabic/English mix accepted. */
  name: string;
  /** Optional existing fields to pass as hints. */
  current_brand?: string;
  current_type?: string;
  current_subkind?: string | null;
  current_appliance_kind?: string | null;
  price?: number;
  description_hint?: string;
  specs?: Record<string, string | number>;
}

export interface ClassifiedProduct extends ClassificationItem {
  id?: string;
  source_name: string;
}

export async function classifyProducts(
  inputs: ClassifyInput[],
): Promise<ClassifiedProduct[]> {
  if (inputs.length === 0) return [];

  const taxonomy = buildTaxonomyBlock();

  const userPayload = JSON.stringify(
    inputs.map((i) => ({
      name: i.name,
      hints: {
        current_brand: i.current_brand || null,
        current_type: i.current_type || null,
        current_subkind: i.current_subkind ?? null,
        current_appliance_kind: i.current_appliance_kind ?? null,
        price: typeof i.price === "number" ? i.price : null,
        description_hint: i.description_hint ? i.description_hint.slice(0, 240) : null,
        specs: i.specs && Object.keys(i.specs).length > 0 ? i.specs : null,
      },
    })),
  );

  const res = await callOpusWithRetry(
    {
      system: [
        { type: "text", text: CLASSIFIER_SYSTEM, cache: true },
        { type: "text", text: BRAND_CANON_BLOCK, cache: true },
        { type: "text", text: taxonomy, cache: true },
      ],
      user: `Classify these products. Return a JSON array with ONE object per input row, in input order:\n\n${userPayload}`,
      // 600 tokens/item leaves comfortable headroom for spec-heavy items and
      // long bilingual names without truncation. Floor at 2000 for single calls.
      maxTokens: Math.min(20000, Math.max(2000, 600 * inputs.length + 800)),
    },
    3,
  );

  const parsed = classificationArraySchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Opus classification returned invalid JSON shape: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join("; ")}`,
    );
  }

  if (parsed.data.length !== inputs.length) {
    throw new Error(
      `Opus returned ${parsed.data.length} items for ${inputs.length} inputs`,
    );
  }

  return parsed.data.map((item, i) => ({
    ...item,
    id: inputs[i].id,
    source_name: inputs[i].name,
  }));
}
