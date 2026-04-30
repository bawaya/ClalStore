// =====================================================
// POST /api/admin/intelligence/find-images
//   Body: { product_id?: uuid, query?: string, limit?: number,
//           prefer_official?: boolean, expected_colors?: [...] }
//   → { candidates, curated, picked, meta }
// Runs a multi-source image search and (if AI key configured)
// hands the candidates to the curator. Does NOT save anything;
// the admin reviews and picks before /save-images writes to DB.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { findImageCandidates } from "@/lib/vision/image-search";
import { curateImages } from "@/lib/vision/image-curator";
import { getProductForImageWork } from "@/lib/vision/image-utils";

const inputSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    query: z.string().min(2).max(200).optional(),
    limit: z.number().int().min(5).max(40).optional(),
    prefer_official: z.boolean().optional().default(true),
    skip_curator: z.boolean().optional().default(false),
    expected_colors: z
      .array(z.object({ name: z.string(), hex: z.string().optional() }))
      .max(20)
      .optional(),
  })
  .refine((d) => d.product_id || d.query, {
    message: "Provide either product_id or query",
  });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        `Invalid body: ${parsed.error.issues
          .slice(0, 2)
          .map((i) => i.message)
          .join("; ")}`,
        400,
      );
    }

    const input = parsed.data;
    let queryName = input.query || "";
    let productCtx: { brand?: string; type?: string; name?: string; expectedColors?: { name: string; hex?: string }[] } = {};

    if (input.product_id) {
      const product = await getProductForImageWork(input.product_id);
      if (!product) return apiError("Product not found", 404);
      const baseName =
        product.name_en ||
        product.name_ar ||
        product.name_he ||
        product.brand ||
        "";
      queryName = (queryName || `${product.brand || ""} ${baseName}`).trim();
      productCtx = {
        brand: product.brand,
        type: product.type,
        name: baseName,
        expectedColors:
          input.expected_colors ??
          (product.colors || []).map((c) => ({
            name: c.name_ar || c.name_he,
            hex: c.hex,
          })),
      };
    }

    if (!queryName) return apiError("Empty search query", 400);

    const candidates = await findImageCandidates(queryName, {
      limit: input.limit ?? 25,
      preferOfficial: input.prefer_official,
    });

    if (candidates.length === 0) {
      return apiSuccess({
        candidates: [],
        picked: [],
        meta: { source_count: 0, model_used: "none", tokens: 0, durationMs: 0 },
      });
    }

    if (input.skip_curator) {
      return apiSuccess({
        candidates,
        picked: [],
        meta: {
          source_count: candidates.length,
          model_used: "none",
          tokens: 0,
          durationMs: 0,
        },
      });
    }

    const curated = await curateImages({
      product_name: productCtx.name || queryName,
      product_brand: productCtx.brand,
      product_type: productCtx.type,
      goal: "all",
      expected_colors: productCtx.expectedColors,
      candidates,
    });

    return apiSuccess({
      candidates,
      curated: curated.output,
      picked: curated.picked,
      meta: {
        source_count: candidates.length,
        ...curated.meta,
      },
    });
  } catch (err) {
    console.error("[intelligence.find-images]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`find-images failed — ${detail}`.slice(0, 600), 500);
  }
}
