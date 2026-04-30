// =====================================================
// POST /api/admin/intelligence/generate
//   Body: { product_id?, current_name_ar?, current_name_he?, ... }
//   Generates English name + AR/HE descriptions in store tone.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { generateContent, type GenerateInput } from "@/lib/intelligence/generator";
import { z } from "zod";

const inputSchema = z.object({
  product_id: z.string().uuid().optional(),
  current_name_ar: z.string().max(300).optional(),
  current_name_he: z.string().max(300).optional(),
  current_name_en: z.string().max(300).optional(),
  current_description_ar: z.string().max(3000).optional(),
  current_description_he: z.string().max(3000).optional(),
  brand: z.string().max(100).optional(),
  type: z.string().max(40).optional(),
  specs: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid body", 400);
    }
    const input: GenerateInput = parsed.data;
    if (!input.current_name_ar && !input.current_name_he && !input.current_name_en) {
      return apiError("At least one current name must be provided", 400);
    }
    const output = await generateContent(input);
    return apiSuccess(output);
  } catch (err) {
    console.error("[intelligence.generate]", err);
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`generate failed — ${detail}`.slice(0, 600), 500);
  }
}
