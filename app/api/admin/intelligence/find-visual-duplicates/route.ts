// =====================================================
// POST /api/admin/intelligence/find-visual-duplicates
//   Body: { type?, limit? }
//   → { groups: [{ product_ids, reason }], meta }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { findVisualDuplicates } from "@/lib/vision/visual-duplicates";

const inputSchema = z.object({
  type: z
    .enum(["device", "accessory", "appliance", "tv", "computer", "tablet", "network"])
    .optional(),
  limit: z.number().int().min(10).max(800).optional().default(300),
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
    const result = await findVisualDuplicates(parsed.data);
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.find-visual-duplicates]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`visual-duplicates failed — ${detail}`.slice(0, 600), 500);
  }
}
