// =====================================================
// POST /api/admin/intelligence/audit-images
//   Body: { limit?: number, type?: ProductType }
//   → { problems: [...], summary, meta }
// Scans existing catalog images and returns problems with score < 7
// or any flagged issues. Admin uses this to find what needs replacing.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auditCatalogImages } from "@/lib/vision/image-auditor";

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

    const result = await auditCatalogImages(parsed.data);
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.audit-images]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`audit-images failed — ${detail}`.slice(0, 600), 500);
  }
}
