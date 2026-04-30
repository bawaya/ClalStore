// =====================================================
// POST /api/admin/intelligence/chat
//   Body: { question, history? }
//   Returns prose answer OR a JSON action proposal.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { askCatalog } from "@/lib/intelligence/catalog-chat";
import { z } from "zod";

const inputSchema = z.object({
  question: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid body", 400);

    const result = await askCatalog(parsed.data.question, parsed.data.history || []);
    return apiSuccess(result);
  } catch (err) {
    console.error("[intelligence.chat]", err);
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`chat failed — ${detail}`.slice(0, 600), 500);
  }
}
