// =====================================================
// POST /api/admin/intelligence/detect-color
//   Body: { image_url: string, product_name?: string, brand?: string }
//   → { hex, name_en, name_ar, name_he, confidence, notes }
// Inspects a single product image and returns dominant color
// metadata, ready to drop into a ProductColor record.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { detectProductColor } from "@/lib/vision/color-detector";

const inputSchema = z.object({
  image_url: z.string().url(),
  product_name: z.string().max(200).optional(),
  brand: z.string().max(100).optional(),
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

    const result = await detectProductColor(parsed.data.image_url, {
      product_name: parsed.data.product_name,
      brand: parsed.data.brand,
    });
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.detect-color]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`detect-color failed — ${detail}`.slice(0, 600), 500);
  }
}
