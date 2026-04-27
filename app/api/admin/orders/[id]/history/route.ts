import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrderStatusHistory } from "@/lib/orders/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withPermission(
  "orders",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
    const orderId = parts.at(-2);
    if (!orderId) {
      return apiError("Missing order id", 400);
    }
    if (!UUID_RE.test(orderId)) {
      return apiError("Order id must be a valid UUID", 400);
    }

    // Confirm the order exists before reporting history; otherwise return 404 so
    // a stale link in the admin UI surfaces a clean message instead of a 500.
    const { data: order, error: orderErr } = await db
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) return apiError(orderErr.message, 500);
    if (!order) return apiError("Order not found", 404);

    const history = await getOrderStatusHistory(db, orderId);
    return apiSuccess(history);
  },
);
