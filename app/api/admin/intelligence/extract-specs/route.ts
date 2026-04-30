// =====================================================
// POST /api/admin/intelligence/extract-specs
//   Body: { image_url, product_id?, product_name?, brand?, type?, merge?: boolean }
//   → { specs, brand_detected, model_detected, ... }
// If product_id + merge=true, also writes the extracted specs into
// products.specs (merged with existing keys, classification_history row added).
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import { extractSpecsFromImage } from "@/lib/vision/spec-extractor";
import { getProductForImageWork } from "@/lib/vision/image-utils";

const inputSchema = z.object({
  image_url: z.string().url(),
  product_id: z.string().uuid().optional(),
  product_name: z.string().max(200).optional(),
  brand: z.string().max(100).optional(),
  type: z.string().max(40).optional(),
  merge: z.boolean().optional().default(false),
});

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

    let hint = {
      product_name: input.product_name,
      brand: input.brand,
      type: input.type,
    };

    // If product_id provided, enrich the hint from the existing row.
    let product = null as Awaited<ReturnType<typeof getProductForImageWork>>;
    if (input.product_id) {
      product = await getProductForImageWork(input.product_id);
      if (product) {
        hint = {
          product_name:
            input.product_name ||
            product.name_en ||
            product.name_ar ||
            product.name_he ||
            undefined,
          brand: input.brand || product.brand,
          type: input.type || product.type,
        };
      }
    }

    const result = await extractSpecsFromImage(input.image_url, hint);

    // Optional merge into products.specs
    if (input.merge && input.product_id && product) {
      const sb = createAdminSupabase();
      const merged: Record<string, string> = {
        ...(product.specs || {}),
        ...result.specs,
      };
      const { error } = await sb
        .from("products")
        .update({ specs: merged })
        .eq("id", input.product_id);
      if (error) return apiError(error.message, 500);

      await sb.from("classification_history").insert({
        product_id: input.product_id,
        before_data: { specs: product.specs || {} },
        after_data: { specs: merged },
        field_confidence: { specs: result.confidence },
        source: "opus_assisted",
      });

      await logAction(
        "مدير",
        `صور AI: استخراج specs من صورة (${Object.keys(result.specs).length} حقل)`,
        "product",
        input.product_id,
      );
    }

    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.extract-specs]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`extract-specs failed — ${detail}`.slice(0, 600), 500);
  }
}
