// =====================================================
// Visual duplicate finder — products whose primary images
// are visually identical (same physical photo) even though
// names/IDs differ. Catches hidden duplicates that name-based
// dedup missed.
//
// Strategy:
//   1. Group candidates by brand+type to keep batches small.
//   2. Within each group of up to 18 images, ask the vision
//      model to cluster visually identical sets.
//   3. Return groups where all member ids reference the SAME
//      visual product.
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";
import { listProductsWithImages } from "./image-utils";
import type { Product } from "@/types/database";

const groupSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(2),
  reason: z.string().max(200),
});

const outputSchema = z.object({
  duplicate_groups: z.array(groupSchema).default([]),
});

export type DuplicateGroup = z.infer<typeof groupSchema>;

const SYSTEM = `You receive a numbered list of product images, each tagged with a product_id and name. Find sets of images that show the SAME visual product (same physical photo OR same product from a different render).

# RULES
- Group images that depict the EXACT same product (same model, same color, same angle is ideal but not required).
- Do NOT group merely similar products (e.g., iPhone 15 vs iPhone 16 are NOT duplicates).
- Do NOT group different colors of the same model — that's a color variant, not a duplicate.
- Group must contain ≥2 product_ids.
- "reason" should be a short Arabic phrase explaining why they're duplicates.

# OUTPUT (strict JSON)
{
  "duplicate_groups": [
    { "product_ids": ["uuid1", "uuid2"], "reason": "..." }
  ]
}

If you find no duplicates, return an empty array.`;

const BATCH_SIZE = 16;

export async function findVisualDuplicates(opts?: {
  type?: Product["type"];
  limit?: number;
}): Promise<{
  groups: DuplicateGroup[];
  meta: { groups_scanned: number; tokens: number; durationMs: number };
}> {
  const products = await listProductsWithImages({
    limit: opts?.limit ?? 400,
    type: opts?.type,
  });

  const withImages = products.filter((p) => !!p.image_url);

  // Bucket by brand|type so we only compare apples to apples.
  const buckets = new Map<
    string,
    Array<{
      id: string;
      name: string;
      url: string;
    }>
  >();
  for (const p of withImages) {
    const key = `${(p.brand || "?").toLowerCase()}|${p.type || "?"}`;
    const list = buckets.get(key) || [];
    list.push({
      id: p.id,
      name: (p.name_en || p.name_ar || p.name_he || "").slice(0, 80),
      url: p.image_url!,
    });
    buckets.set(key, list);
  }

  const start = Date.now();
  const allGroups: DuplicateGroup[] = [];
  let totalTokens = 0;
  let groupsScanned = 0;

  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const slice = list.slice(i, i + BATCH_SIZE);
      if (slice.length < 2) continue;
      groupsScanned++;

      const userBlocks: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [
        {
          type: "text",
          text:
            `Find visual duplicates among these ${slice.length} products.\n` +
            slice
              .map(
                (r, j) =>
                  `[${j}] product_id=${r.id} name="${r.name}"`,
              )
              .join("\n"),
        },
      ];
      slice.forEach((r) => {
        userBlocks.push({ type: "image", url: r.url });
      });

      try {
        const res = await callGateway({
          model: DEFAULT_VISION_MODEL,
          fallbackModels: [FALLBACK_VISION_MODEL],
          system: SYSTEM,
          user: userBlocks,
          maxTokens: 1500,
          temperature: 0,
          tags: ["feature:visual-duplicates"],
          cacheControl: "max-age=86400",
        });
        totalTokens += res.usage.total;
        const parsed = outputSchema.safeParse(res.json);
        if (parsed.success) {
          // Filter out IDs not in this batch (vision sometimes hallucinates).
          const idSet = new Set(slice.map((r) => r.id));
          for (const g of parsed.data.duplicate_groups) {
            const valid = g.product_ids.filter((id) => idSet.has(id));
            if (valid.length >= 2) {
              allGroups.push({ product_ids: valid, reason: g.reason });
            }
          }
        }
      } catch (err) {
        console.warn(
          "[visual-duplicates] batch failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return {
    groups: allGroups,
    meta: { groups_scanned: groupsScanned, tokens: totalTokens, durationMs: Date.now() - start },
  };
}
