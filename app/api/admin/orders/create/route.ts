import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { manualOrderSchema, validateBody } from "@/lib/admin/validators";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createManualOrder } from "@/lib/orders/admin";
import type { ManualOrderPayload } from "@/lib/orders/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const POST = withPermission(
  "orders",
  "create",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const body = await req.json();
    const validation = validateBody(body, manualOrderSchema);
    if (validation.error) {
      return apiError(validation.error, 400);
    }

    const order = await createManualOrder(db, user, validation.data as ManualOrderPayload);
    return apiSuccess(order, undefined, 201);
  },
);
