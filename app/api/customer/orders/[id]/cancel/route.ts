// =====================================================
// POST /api/customer/orders/:id/cancel
// Customer-initiated cancellation under Israeli Consumer
// Protection Cancellation Regulations 2010.
//
// Rules enforced:
//  • Default window: 14 days from delivery (distance sale)
//  • Extended window: 4 months for elderly/disabled/new immigrant
//    (via customer flag) — opt-in self-declaration
//  • Cancellation fee: 5% of total or ₪100, whichever is lower
//    (only when cancelling NOT due to defect)
//  • Orders already shipped/delivered also cancellable within window
// =====================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase";
import { authenticateCustomer } from "@/lib/customer-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const bodySchema = z.object({
  reason: z.enum(["changed_mind", "defect", "late_delivery", "wrong_item", "other"]),
  notes: z.string().max(1000).optional(),
  /** If true the customer declares being eligible for the 4-month extended window. */
  extended_window: z.boolean().optional().default(false),
});

// Cancellation-not-allowed statuses (already finalised/returned/too late)
const FINALISED_STATUSES = new Set(["cancelled", "rejected", "returned"]);

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params;

  const customer = await authenticateCustomer(req);
  if (!customer) return apiError("غير مصرح", 401);

  const rl = checkRateLimit(getRateLimitKey(clientIp(req), "cancel-order"), {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) return apiError("طلبات كثيرة — حاول لاحقاً", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid body", 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("بيانات غير صالحة", 400);

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("Service unavailable", 503);

  // 1. Fetch the order — must belong to this customer
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("customer_id", customer.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !order) return apiError("الطلب غير موجود", 404);

  // 2. Idempotency — if already cancelled, return current state
  if (order.status === "cancelled") {
    return apiSuccess({ already_cancelled: true, order });
  }

  if (FINALISED_STATUSES.has(order.status)) {
    return apiError("لا يمكن إلغاء هذا الطلب بوضعه الحالي", 409);
  }

  // 3. Check cancellation window
  const delivered = order.delivered_at || order.shipped_at || order.created_at;
  const age = daysSince(delivered);
  const maxDays = parsed.data.extended_window ? 120 : 14;
  if (age > maxDays) {
    return apiError(
      parsed.data.extended_window
        ? "انقضت فترة الإلغاء الممتدة (4 شهور)"
        : "انقضت فترة الإلغاء القانونية (14 يوم)",
      409,
    );
  }

  // 4. Compute fee. If reason is "defect", no fee. Otherwise 5% or ₪100, whichever is lower.
  const total = Number(order.total) || 0;
  const fee =
    parsed.data.reason === "defect"
      ? 0
      : Math.min(100, Math.round(total * 0.05 * 100) / 100);
  const refund = Math.max(0, total - fee);

  // 5. Update the order
  const { error: updErr } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at_customer: new Date().toISOString(),
      cancelled_by: "customer",
      cancellation_reason: parsed.data.reason + (parsed.data.notes ? ` — ${parsed.data.notes}` : ""),
      cancellation_fee: fee,
      cancellation_refund: refund,
      extended_cancel_window: parsed.data.extended_window || false,
    })
    .eq("id", orderId)
    .eq("customer_id", customer.id);

  if (updErr) {
    console.error("Cancel update error:", updErr);
    return apiError("فشل إلغاء الطلب", 500);
  }

  // 6. Best-effort audit log (does not block success)
  try {
    await supabase.from("audit_log").insert({
      entity: "order",
      entity_id: orderId,
      action: "customer_cancelled",
      meta: {
        reason: parsed.data.reason,
        fee,
        refund,
        extended: parsed.data.extended_window || false,
      },
      actor: `customer:${customer.id}`,
    });
  } catch {
    /* audit_log table may not exist in some envs */
  }

  return apiSuccess({
    cancelled: true,
    fee,
    refund,
    reason: parsed.data.reason,
    message:
      parsed.data.reason === "defect"
        ? "تم إلغاء الطلب بدون أي رسوم (منتج معيب)"
        : `تم إلغاء الطلب. سيتم استرداد ₪${refund} خلال 14 يوم عمل`,
  });
}
