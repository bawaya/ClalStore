// =====================================================
// POST /api/admin/intelligence/generate-alt-text
//   Body (single):
//     { image_url, brand?, product_name?, product_type?, color? }
//   Body (product-wide):
//     { product_id }
//   → { primary?, gallery: [...], colors: [...] }
//
// Does not persist alt-text yet (no schema column for it). Returns
// the generated triples so the admin can copy-paste, or so a future
// migration can fold them into a gallery_alts JSONB column.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  generateAltText,
  generateAltsForProduct,
} from "@/lib/vision/alt-text-generator";
import { getProductForImageWork } from "@/lib/vision/image-utils";

const inputSchema = z.union([
  z.object({
    mode: z.literal("single").optional().default("single"),
    image_url: z.string().url(),
    brand: z.string().max(100).optional(),
    product_name: z.string().max(200).optional(),
    product_type: z.string().max(40).optional(),
    color: z.string().max(60).optional(),
  }),
  z.object({
    mode: z.literal("product"),
    product_id: z.string().uuid(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        `Invalid body: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        400,
      );
    }
    const input = parsed.data;

    if ("mode" in input && input.mode === "product") {
      const product = await getProductForImageWork(input.product_id);
      if (!product) return apiError("Product not found", 404);

      const result = await generateAltsForProduct({
        brand: product.brand,
        product_name: product.name_en || product.name_ar || product.name_he,
        product_type: product.type,
        primary: product.image_url,
        gallery: product.gallery,
        colors: (product.colors || [])
          .filter((c) => !!c.image)
          .map((c) => ({
            name: c.name_ar || c.name_he || "",
            image: c.image as string,
          })),
      });
      return apiSuccess(result);
    }

    const result = await generateAltText({
      image_url: input.image_url,
      brand: input.brand,
      product_name: input.product_name,
      product_type: input.product_type,
      color: input.color,
    });
    return apiSuccess({ primary: result, gallery: [], colors: [] });
  } catch (err) {
    console.error("[intelligence.generate-alt-text]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`generate-alt-text failed — ${detail}`.slice(0, 600), 500);
  }
}
