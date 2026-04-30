// =====================================================
// Image curator — given candidates, ask vision AI to pick
// the best 5: clean background, official angle, no
// watermark, matches the requested model.
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";
import type { ImageCandidate } from "./image-search";

const curatorOutputSchema = z.object({
  selections: z
    .array(
      z.object({
        index: z.number().int().min(0),
        score: z.number().min(0).max(10),
        role: z
          .enum(["primary", "gallery", "color_variant", "lifestyle", "reject"])
          .default("gallery"),
        color_label: z.string().nullable().optional(),
        reason: z.string().max(160),
      }),
    )
    .min(0)
    .max(15),
  rejected_count: z.number().int().min(0).default(0),
  global_notes: z.string().max(300).optional().default(""),
});

export type CuratorSelection = z.infer<typeof curatorOutputSchema>["selections"][number];
export type CuratorOutput = z.infer<typeof curatorOutputSchema>;

export interface CurateInput {
  product_name: string;
  product_brand?: string;
  product_type?: string;
  /** What the curator should aim for — primary + gallery + per-color. */
  goal?: "primary" | "gallery" | "color_variants" | "all";
  /** Restrict acceptable colors when curating color variants. */
  expected_colors?: { name: string; hex?: string }[];
  candidates: ImageCandidate[];
}

const SYSTEM_PROMPT = `You are an expert e-commerce product image curator for ClalMobile, a mobile/electronics retail catalog.

You receive a product description and a numbered list of candidate images. Your job: pick the best images and assign each a role.

# CRITERIA (apply strictly)
- Clean background (white / soft gradient / studio); reject cluttered or lifestyle-only shots when product clarity matters
- Official front 3/4 angle preferred for hero/primary
- No visible watermarks, retailer logos, price tags, or text overlays
- Matches the requested brand and model exactly — reject look-alikes from a different generation
- High resolution, in focus, full product visible (not cropped)
- Reject: stock photos that don't show the actual model, lifestyle shots with humans dominating, blurry/low-res, with watermarks
- For color variants: pick one image per requested color, match by visible color of the product body

# OUTPUT (strict JSON, no prose)
{
  "selections": [
    {
      "index": <0-based index of the candidate>,
      "score": <0-10, your quality rating>,
      "role": "primary" | "gallery" | "color_variant" | "lifestyle" | "reject",
      "color_label": <if role=color_variant, the color name; null otherwise>,
      "reason": "<short Arabic phrase, max 160 chars>"
    }
  ],
  "rejected_count": <number of candidates you rejected>,
  "global_notes": "<optional Arabic note about overall quality, max 300 chars>"
}

Rules:
- Only output candidates you'd ACTUALLY use. Skip ones you'd reject.
- At most ONE primary.
- Up to 5 gallery images.
- One color_variant per expected color (if expected_colors provided).
- "reason" should be brief Arabic — explain why you picked it or why it's a fallback.`;

export async function curateImages(input: CurateInput): Promise<{
  output: CuratorOutput;
  picked: Array<CuratorSelection & { candidate: ImageCandidate }>;
  meta: { model_used: string; tokens: number; durationMs: number };
}> {
  if (input.candidates.length === 0) {
    return {
      output: { selections: [], rejected_count: 0, global_notes: "no candidates" },
      picked: [],
      meta: { model_used: "n/a", tokens: 0, durationMs: 0 },
    };
  }

  const goal = input.goal ?? "all";
  const expected =
    input.expected_colors && input.expected_colors.length > 0
      ? `\nExpected colors: ${input.expected_colors.map((c) => c.name).join(", ")}`
      : "";

  const userText =
    `Product: ${input.product_name}\n` +
    (input.product_brand ? `Brand: ${input.product_brand}\n` : "") +
    (input.product_type ? `Type: ${input.product_type}\n` : "") +
    `Curation goal: ${goal}` +
    expected +
    `\n\nCandidates (${input.candidates.length} images, indexed in order shown):`;

  const userBlocks: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [
    { type: "text", text: userText },
  ];
  input.candidates.forEach((c, i) => {
    userBlocks.push({ type: "text", text: `[${i}] ${c.title || ""} (${c.domain || c.source})` });
    userBlocks.push({ type: "image", url: c.thumbnail || c.url });
  });

  const res = await callGateway({
    model: DEFAULT_VISION_MODEL,
    fallbackModels: [FALLBACK_VISION_MODEL],
    system: SYSTEM_PROMPT,
    user: userBlocks,
    maxTokens: 1500,
    temperature: 0,
    tags: ["feature:image-curator"],
  });

  const parsed = curatorOutputSchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Curator output invalid: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const picked = parsed.data.selections
    .filter((s) => s.role !== "reject")
    .map((s) => ({ ...s, candidate: input.candidates[s.index] }))
    .filter((s) => !!s.candidate);

  return {
    output: parsed.data,
    picked,
    meta: {
      model_used: res.model_used,
      tokens: res.usage.total,
      durationMs: res.durationMs,
    },
  };
}
