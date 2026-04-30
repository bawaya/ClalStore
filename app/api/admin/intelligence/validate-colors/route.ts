// =====================================================
// POST /api/admin/intelligence/validate-colors
//   Body: { limit?, type? }
//   → { mismatches: [...], total_checked, meta }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { validateColorImages } from "@/lib/vision/color-validator";

const inputSchema = z.object({
  limit: z.number().int().min(10).max(500).optional().default(150),
  type: z
    .enum(["device", "accessory", "appliance", "tv", "computer", "tablet", "network"])
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        `Invalid body: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        400,
      );
    }
    const result = await validateColorImages(parsed.data);
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.validate-colors]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`validate-colors failed — ${detail}`.slice(0, 600), 500);
  }
}
