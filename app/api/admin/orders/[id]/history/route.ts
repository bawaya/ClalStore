import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrderStatusHistory } from "@/lib/orders/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withPermission(
  "orders",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
    const orderId = parts.at(-2);
    if (!orderId) {
      return apiError("Missing order id", 400);
    }

    const history = await getOrderStatusHistory(db, orderId);
    return apiSuccess(history);
  },
);
