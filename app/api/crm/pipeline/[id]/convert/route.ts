import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { manualOrderSchema } from "@/lib/admin/validators";
import { convertPipelineDealToOrder } from "@/lib/crm/pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withPermission(
    "orders",
    "create",
    async (innerReq: NextRequest, db: SupabaseClient, user) => {
      const rawBody = await innerReq.json().catch(() => ({}));
      const validation = manualOrderSchema.partial().safeParse(rawBody);
      if (!validation.success) {
        const message = validation.error.issues.map((issue: { message: string }) => issue.message).join("; ");
        return apiError(message || "Invalid payload", 400);
      }

      const result = await convertPipelineDealToOrder(db, user, id, validation.data);
      return apiSuccess(result);
    },
  )(req);
}
