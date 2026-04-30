// =====================================================
// POST /api/admin/intelligence/classify
//   Body: { items: [{ id?, name, current_brand?, current_type? }] }
//   Returns suggestions only — does NOT write. Use /apply to commit.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { classifyProducts, type ClassifyInput } from "@/lib/intelligence/classifier";
import { z } from "zod";

const inputSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(500),
        current_brand: z.string().max(100).optional(),
        current_type: z.string().max(40).optional(),
        current_subkind: z.string().max(40).nullable().optional(),
        current_appliance_kind: z.string().max(40).nullable().optional(),
        price: z.number().nonnegative().optional(),
        description_hint: z.string().max(500).optional(),
        specs: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      }),
    )
    .min(1)
    .max(50),
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

    const items: ClassifyInput[] = parsed.data.items;
    const suggestions = await classifyProducts(items);
    return apiSuccess({ suggestions });
  } catch (err) {
    // Surface real error to admin UI — this endpoint is already admin-gated.
    console.error("[intelligence.classify]", err);
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`classify failed — ${detail}`.slice(0, 600), 500);
  }
}
