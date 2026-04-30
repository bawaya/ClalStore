// =====================================================
// Catalog image auditor — scan existing product images
// and rate quality. Flags watermarks, low-res, wrong-product,
// inconsistent backgrounds, missing color images.
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";
import { listProductsWithImages } from "./image-utils";
import type { Product } from "@/types/database";

const auditItemSchema = z.object({
  product_id: z.string().uuid(),
  field: z.enum(["image_url", "gallery", "color"]),
  /** Index inside gallery[] or colors[] for granular reporting. */
  field_index: z.number().int().min(0).optional(),
  url: z.string(),
  score: z.number().min(0).max(10),
  issues: z.array(
    z.enum([
      "low_resolution",
      "blurry",
      "watermark",
      "wrong_product",
      "lifestyle_only",
      "cluttered_background",
      "cropped",
      "color_mismatch",
      "broken",
      "duplicate",
    ]),
  ),
  reason: z.string().max(200),
});

const auditOutputSchema = z.object({
  problems: z.array(auditItemSchema).default([]),
  summary: z.object({
    total_scanned: z.number().int().min(0),
    problem_count: z.number().int().min(0),
    avg_score: z.number().min(0).max(10),
  }),
});

export type AuditProblem = z.infer<typeof auditItemSchema>;
export type AuditOutput = z.infer<typeof auditOutputSchema>;

const AUDITOR_SYSTEM = `You are a catalog image quality auditor for ClalMobile, a mobile/electronics retail store in Israel.

You will receive product records (id, name, brand, type) along with image URLs displayed inline. For each image you must rate quality 0-10 and flag issues.

# CRITERIA
- 8-10: Clean studio shot, white/light background, official angle, in focus, no overlays
- 5-7: Acceptable but flawed (slight clutter, minor crop, slightly low resolution)
- 0-4: Reject-quality (watermark, lifestyle-only, wrong product, broken/loaded, blurry, very low res)

# ISSUE LABELS (use exactly these)
- low_resolution: visibly pixelated or under ~400px
- blurry: out of focus
- watermark: visible logo/text overlay/retailer brand
- wrong_product: doesn't match the brand/model in the product name
- lifestyle_only: human/scene dominates, product not clearly featured
- cluttered_background: busy or distracting backdrop
- cropped: product partially cut off
- color_mismatch: marked as a color but product appears different color
- broken: image failed to load / shows error placeholder
- duplicate: visually identical to another image already listed

# OUTPUT (strict JSON)
{
  "problems": [
    {
      "product_id": "<uuid>",
      "field": "image_url" | "gallery" | "color",
      "field_index": <number, only if gallery or color>,
      "url": "<the image URL you scored>",
      "score": <0-10>,
      "issues": ["watermark", "low_resolution"],
      "reason": "<short Arabic explanation, max 200 chars>"
    }
  ],
  "summary": {
    "total_scanned": <total images you reviewed>,
    "problem_count": <count where score < 6>,
    "avg_score": <average across all scanned>
  }
}

Only include items in "problems" with score < 7 OR with at least one issue. Skip 7+ items with no issues.`;

interface AuditedImageRow {
  product_id: string;
  product_name: string;
  product_brand: string;
  product_type: string;
  field: "image_url" | "gallery" | "color";
  field_index?: number;
  url: string;
  color_label?: string;
}

function flattenProducts(
  products: Awaited<ReturnType<typeof listProductsWithImages>>,
): AuditedImageRow[] {
  const rows: AuditedImageRow[] = [];
  for (const p of products) {
    const ctx = {
      product_id: p.id,
      product_name: p.name_en || p.name_ar || p.name_he || "(unnamed)",
      product_brand: p.brand || "",
      product_type: p.type || "",
    };
    if (p.image_url) {
      rows.push({ ...ctx, field: "image_url", url: p.image_url });
    }
    (p.gallery || []).forEach((url, idx) => {
      if (url) rows.push({ ...ctx, field: "gallery", field_index: idx, url });
    });
    (p.colors || []).forEach((c, idx) => {
      if (c?.image) {
        rows.push({
          ...ctx,
          field: "color",
          field_index: idx,
          url: c.image,
          color_label: c.name_ar || c.name_he,
        });
      }
    });
  }
  return rows;
}

/** Audit a batch of image rows. Vision models can comfortably handle ~25 images per call. */
const BATCH_SIZE = 20;

export async function auditCatalogImages(opts?: {
  limit?: number;
  type?: Product["type"];
}): Promise<{
  output: AuditOutput;
  meta: { batches: number; total_tokens: number; durationMs: number };
}> {
  const products = await listProductsWithImages({
    limit: opts?.limit ?? 200,
    type: opts?.type,
  });
  const rows = flattenProducts(products);

  if (rows.length === 0) {
    return {
      output: {
        problems: [],
        summary: { total_scanned: 0, problem_count: 0, avg_score: 0 },
      },
      meta: { batches: 0, total_tokens: 0, durationMs: 0 },
    };
  }

  const allProblems: AuditProblem[] = [];
  let totalTokens = 0;
  let totalScore = 0;
  let scanned = 0;
  const start = Date.now();
  let batches = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const userBlocks: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [
      {
        type: "text",
        text:
          `Batch ${batches + 1}: audit ${slice.length} images. ` +
          `For each, rate quality 0-10 and flag issues. ` +
          `Use the exact product_id and field/field_index given.\n\n` +
          slice
            .map(
              (r, j) =>
                `[${j}] product_id=${r.product_id} field=${r.field}${
                  r.field_index !== undefined ? ` index=${r.field_index}` : ""
                } | name="${r.product_name}" brand="${r.product_brand}" type=${r.product_type}${
                  r.color_label ? ` color="${r.color_label}"` : ""
                } | url=${r.url}`,
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
        system: AUDITOR_SYSTEM,
        user: userBlocks,
        maxTokens: 3000,
        temperature: 0,
        tags: ["feature:image-auditor"],
        cacheControl: "max-age=1800",
      });
      totalTokens += res.usage.total;

      const parsed = auditOutputSchema.safeParse(res.json);
      if (parsed.success) {
        allProblems.push(...parsed.data.problems);
        scanned += parsed.data.summary.total_scanned || slice.length;
        totalScore += (parsed.data.summary.avg_score || 0) * (parsed.data.summary.total_scanned || slice.length);
      }
    } catch (err) {
      console.warn("[image-auditor] batch failed:", err instanceof Error ? err.message : err);
      // continue with next batch
    }
    batches++;
  }

  return {
    output: {
      problems: allProblems,
      summary: {
        total_scanned: scanned,
        problem_count: allProblems.length,
        avg_score: scanned > 0 ? totalScore / scanned : 0,
      },
    },
    meta: { batches, total_tokens: totalTokens, durationMs: Date.now() - start },
  };
}
