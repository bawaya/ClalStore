// =====================================================
// POST /api/admin/intelligence/apply
//   Body: { items: [{ product_id, classification, source? }] }
//   Writes products + classification_history.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { applyClassifications, getProductsByIds, type ApplyInput } from "@/lib/intelligence/store";
import { classificationItemSchema } from "@/lib/intelligence/schemas";
import { logAction } from "@/lib/admin/queries";
import { z } from "zod";

const inputSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        classification: classificationItemSchema,
        source: z.enum(["opus_auto", "opus_assisted", "human"]).optional().default("human"),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        `Invalid body: ${parsed.error.issues.slice(0, 2).map((i) => i.message).join("; ")}`,
        400,
      );
    }

    // Snapshot current state per product (for audit before_data)
    const ids = parsed.data.items.map((i) => i.product_id);
    const before = await getProductsByIds(ids);
    const beforeMap = new Map(before.map((p) => [p.id, p]));

    const reviewedBy = (auth as { appUserId?: string }).appUserId;

    const inputs: ApplyInput[] = parsed.data.items.map((item) => ({
      product_id: item.product_id,
      before: beforeMap.get(item.product_id) || {},
      classification: item.classification,
      source: item.source,
      reviewed_by: reviewedBy,
    }));

    const result = await applyClassifications(inputs);
    await logAction(
      "مدير",
      `تطبيق تصنيف ذكي على ${result.applied} منتج`,
      "product",
      ids[0],
    );
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.apply]", err);
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`apply failed — ${detail}`.slice(0, 600), 500);
  }
}
