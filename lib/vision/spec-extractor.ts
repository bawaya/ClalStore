// =====================================================
// Spec sheet OCR — paste a screenshot of a datasheet,
// catalog page, or back-of-box and the vision model
// returns structured key:value specs ready to drop into
// the product.specs JSONB column.
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";

const specOutputSchema = z.object({
  specs: z.record(z.string().max(40), z.union([z.string(), z.number()]).transform(String)),
  brand_detected: z.string().max(60).nullable().optional(),
  model_detected: z.string().max(120).nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  notes: z.string().max(300).optional().default(""),
});

export type ExtractedSpecs = z.infer<typeof specOutputSchema>;

const SPEC_EXTRACTOR_SYSTEM = `You extract structured product specifications from images of datasheets, packaging, manufacturer pages, or marketing material.

# RULES
- Return ONLY specs you can read clearly from the image. Don't fabricate.
- Use canonical English snake_case keys: ram, storage, battery_mah, screen_size_in, screen_resolution, refresh_rate_hz, camera_main_mp, camera_ultrawide_mp, camera_front_mp, processor, weight_g, water_resistance, charging_w, charging_wireless_w, ports, connectivity, os, color, dimensions_mm, etc.
- Values are short strings. Examples:
  - ram: "8GB"
  - storage: "256GB"
  - battery_mah: "5000"
  - screen_size_in: "6.7"
  - screen_resolution: "2796x1290"
  - refresh_rate_hz: "120"
- For numeric measurements include the unit when ambiguous (W, mAh, GB, MP).
- Skip marketing fluff (e.g., "amazing", "next-gen") — only hard specs.
- If you can read the brand/model name from the image, return them in brand_detected/model_detected.
- confidence reflects how clear the source image is.

# OUTPUT (strict JSON)
{
  "specs": {
    "ram": "8GB",
    "storage": "256GB",
    "battery_mah": "5000",
    "screen_size_in": "6.7"
  },
  "brand_detected": "Samsung" | null,
  "model_detected": "Galaxy S25 Ultra" | null,
  "confidence": 0.92,
  "notes": "<optional Arabic note about ambiguities, max 300 chars>"
}`;

export async function extractSpecsFromImage(
  imageUrl: string,
  hint?: { product_name?: string; brand?: string; type?: string },
): Promise<ExtractedSpecs> {
  const ctx =
    (hint?.product_name ? `Hint — product name: ${hint.product_name}\n` : "") +
    (hint?.brand ? `Hint — brand: ${hint.brand}\n` : "") +
    (hint?.type ? `Hint — type: ${hint.type}\n` : "");

  const res = await callGateway({
    model: DEFAULT_VISION_MODEL,
    fallbackModels: [FALLBACK_VISION_MODEL],
    system: SPEC_EXTRACTOR_SYSTEM,
    user: [
      {
        type: "text",
        text: ctx + "Extract specs from this image as JSON.",
      },
      { type: "image", url: imageUrl },
    ],
    maxTokens: 1500,
    temperature: 0,
    tags: ["feature:spec-extractor"],
    cacheControl: "max-age=86400",
  });

  const parsed = specOutputSchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Spec extractor output invalid: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
