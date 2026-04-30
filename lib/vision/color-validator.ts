// =====================================================
// Color-image validator — for each ProductColor with an
// image attached, confirm the visible product body color
// actually matches the labeled color name. Catches:
//   • copy-paste mistakes (red label on a blue phone)
//   • wrong color images from automated bulk-fetch
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";
import { listProductsWithImages } from "./image-utils";
import type { Product } from "@/types/database";

const itemSchema = z.object({
  product_id: z.string().uuid(),
  color_index: z.number().int().min(0),
  label: z.string(),
  image_url: z.string(),
  matches: z.boolean(),
  detected_color_name: z.string().max(40).nullable().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

const outputSchema = z.object({
  mismatches: z.array(itemSchema).default([]),
  total_checked: z.number().int().min(0),
});

export type ColorMismatch = z.infer<typeof itemSchema>;

const SYSTEM = `You validate that a product image matches its labeled color.

For each item you receive:
- a labeled color name (Arabic/Hebrew/English mixed)
- the product image displayed inline

Decide if the visible body color of the product matches the label.

# RULES
- Be lenient on synonyms (Black ↔ أسود ↔ שחור ↔ Midnight ↔ Graphite all = dark)
- Be strict on real mismatches (label says "أحمر" but the phone is clearly green)
- For multi-tone colors (Titanium, Pearl), accept any close shade
- detected_color_name: short English description of what you actually see (e.g., "deep blue", "matte black")
- Only include items where matches=false in the output

# OUTPUT (strict JSON)
{
  "mismatches": [
    {
      "product_id": "<uuid>",
      "color_index": <number>,
      "label": "<original color label>",
      "image_url": "<the url shown>",
      "matches": false,
      "detected_color_name": "deep blue",
      "confidence": 0.93,
      "reason": "<short Arabic explanation, max 200 chars>"
    }
  ],
  "total_checked": <number of color images you reviewed>
}`;

const BATCH_SIZE = 15;

export async function validateColorImages(opts?: {
  limit?: number;
  type?: Product["type"];
}): Promise<{
  mismatches: ColorMismatch[];
  total_checked: number;
  meta: { batches: number; tokens: number; durationMs: number };
}> {
  const products = await listProductsWithImages({
    limit: opts?.limit ?? 200,
    type: opts?.type,
  });

  // Flatten to one row per (product, color-with-image)
  type Row = {
    product_id: string;
    color_index: number;
    label: string;
    image_url: string;
  };
  const rows: Row[] = [];
  for (const p of products) {
    (p.colors || []).forEach((c, idx) => {
      if (c?.image) {
        rows.push({
          product_id: p.id,
          color_index: idx,
          label: c.name_ar || c.name_he || "",
          image_url: c.image,
        });
      }
    });
  }

  if (rows.length === 0) {
    return {
      mismatches: [],
      total_checked: 0,
      meta: { batches: 0, tokens: 0, durationMs: 0 },
    };
  }

  const start = Date.now();
  const allMismatches: ColorMismatch[] = [];
  let totalTokens = 0;
  let batches = 0;
  let totalChecked = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const userBlocks: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [
      {
        type: "text",
        text:
          `Validate ${slice.length} color-labeled images.\n` +
          slice
            .map(
              (r, j) =>
                `[${j}] product_id=${r.product_id} color_index=${r.color_index} label="${r.label}"`,
            )
            .join("\n"),
      },
    ];
    slice.forEach((r) => {
      userBlocks.push({ type: "image", url: r.image_url });
    });

    try {
      const res = await callGateway({
        model: DEFAULT_VISION_MODEL,
        fallbackModels: [FALLBACK_VISION_MODEL],
        system: SYSTEM,
        user: userBlocks,
        maxTokens: 2000,
        temperature: 0,
        tags: ["feature:color-validator"],
        cacheControl: "max-age=86400",
      });
      totalTokens += res.usage.total;
      const parsed = outputSchema.safeParse(res.json);
      if (parsed.success) {
        // Normalize URLs back from indices if the model returned indices instead.
        for (const m of parsed.data.mismatches) {
          // Trust the model's product_id/color_index since we passed them; ensure URL.
          const matched = slice.find(
            (r) => r.product_id === m.product_id && r.color_index === m.color_index,
          );
          if (matched) {
            allMismatches.push({ ...m, image_url: matched.image_url, label: matched.label });
          }
        }
        totalChecked += parsed.data.total_checked || slice.length;
      }
    } catch (err) {
      console.warn("[color-validator] batch failed:", err instanceof Error ? err.message : err);
    }
    batches++;
  }

  return {
    mismatches: allMismatches,
    total_checked: totalChecked,
    meta: { batches, tokens: totalTokens, durationMs: Date.now() - start },
  };
}
