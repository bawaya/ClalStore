// =====================================================
// Content Generator — Tab 3
// Generates name_en + description_ar/_he for a product, in the
// store's existing tone (learned from sample descriptions).
// =====================================================

import { callOpusWithRetry } from "./opus-client";
import { GENERATOR_SYSTEM, BRAND_CANON_BLOCK } from "./prompts";
import { generatorOutputSchema, type GeneratorOutput } from "./schemas";
import { loadDescriptionSamples } from "./context-builder";

export interface GenerateInput {
  current_name_ar?: string;
  current_name_he?: string;
  current_name_en?: string;
  current_description_ar?: string;
  current_description_he?: string;
  brand?: string;
  type?: string;
  specs?: Record<string, string>;
}

export async function generateContent(input: GenerateInput): Promise<GeneratorOutput> {
  const samples = await loadDescriptionSamples(20);
  const sampleBlock = samples.length
    ? `# STORE TONE EXAMPLES\n${samples
        .map(
          (s) =>
            `- ${s.name_en}\n  AR: ${s.description_ar.slice(0, 200)}\n  HE: ${s.description_he.slice(0, 200)}`,
        )
        .join("\n\n")}`
    : "# STORE TONE EXAMPLES\n(none — use neutral retail tone)";

  const userPayload = {
    name_ar: input.current_name_ar || "",
    name_he: input.current_name_he || "",
    name_en: input.current_name_en || "",
    brand: input.brand || "",
    type: input.type || "",
    specs: input.specs || {},
    existing_description_ar: input.current_description_ar || "",
    existing_description_he: input.current_description_he || "",
  };

  const res = await callOpusWithRetry(
    {
      system: [
        { type: "text", text: GENERATOR_SYSTEM, cache: true },
        { type: "text", text: BRAND_CANON_BLOCK, cache: true },
        { type: "text", text: sampleBlock },
      ],
      user: `Generate marketing content for this product. Return strict JSON.\n\n${JSON.stringify(userPayload)}`,
      maxTokens: 1500,
    },
    3,
  );

  const parsed = generatorOutputSchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Generator output invalid: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
