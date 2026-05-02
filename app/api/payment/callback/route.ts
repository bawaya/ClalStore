// =====================================================
// ClalMobile — iCredit IPN Callback
// iCredit sends POST with sale results after payment
// IPN fields: GroupPrivateToken, SaleId, CustomerTransactionId,
//   TransactionAmount, TransactionToken, NumberOfPayments,
//   CardLastFourDigits, Custom1 (orderId), etc.
// Docs: https://rivhit-api.readme.io/docs/ipn-by-sale-types
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/webhook-verify";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getIntegrationConfig } from "@/lib/integrations/hub";
import { recordPaymentOutcome } from "@/lib/analytics";

type CallbackOrderItem = {
  product_type?: string | null;
};

type CallbackOrder = {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  total?: number | string | null;
};

function amountsMatch(providerAmount: number, orderTotal: number) {
  return Math.abs(providerAmount - orderTotal) <= 1;
}

function isOnlinePaymentEligible(items: CallbackOrderItem[]) {
  return items.length > 0 && items.every((item) => item.product_type === "accessory");
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookCfg = await getIntegrationConfig("webhook_security");

    // HMAC signature verification (additional layer before IPN check)
    const webhookSignature =
      req.headers.get("x-signature") ||
      req.headers.get("x-webhook-signature");
    const paymentWebhookSecret = String(
      webhookCfg.payment_webhook_secret || process.env.PAYMENT_WEBHOOK_SECRET || ""
    ).trim();

    const requireWebhookSignature = process.env.NODE_ENV === "production";

    if (!paymentWebhookSecret && requireWebhookSignature) {
      console.error("Payment webhook: missing HMAC secret in production");
      return apiError("Invalid webhook signature", 401);
    }

    if (!webhookSignature && requireWebhookSignature) {
      console.error("Payment webhook: missing HMAC signature in production");
      return apiError("Invalid webhook signature", 401);
    }

    if (webhookSignature && paymentWebhookSecret) {
      const valid = await verifyWebhookSignature(rawBody, webhookSignature, paymentWebhookSecret);
      if (!valid) {
        console.error("Payment webhook: invalid HMAC signature");
        return apiError("Invalid webhook signature", 401);
      }
    } else if (!webhookSignature) {
      console.warn("Payment webhook: no signature header present — falling through to IPN verification");
    }

    let body: Record<string, any>;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      body = Object.fromEntries(params.entries());
    } else {
      body = JSON.parse(rawBody);
    }

    // IPN received — only log order ID

    const saleId = body.SaleId || body.saleid;
    const orderId = body.Custom1 || body.custom1;
    const amount = parseFloat(body.TransactionAmount || body.transactionamount || "0");
    const token = body.TransactionToken || body.transactiontoken || "";
    const cardLast4 = body.CardLastFourDigits || body.cardlastfourdigits || "";
    const numPayments = parseInt(body.NumberOfPayments || body.numberofpayments || "1", 10);
    const customerTransactionId = body.CustomerTransactionId || body.customertransactionid || "";
    const paramJ = body.TransactionParamJ || body.transactionparamj;

    if (!orderId) {
      console.error("iCredit IPN: missing orderId (Custom1)");
      return apiError("Missing order ID", 400);
    }

    const db = createAdminSupabase();

    const { data: existingOrder } = await db.from("orders")
      .select("id, status, payment_status, total")
      .eq("id", orderId)
      .single();

    if (!existingOrder) {
      console.error("iCredit IPN: order not found:", orderId);
      return apiError("Order not found", 404);
    }

    if (existingOrder.payment_status === "paid") {
      console.warn("iCredit IPN: order already paid:", orderId);
      return apiSuccess({ received: true, note: "already_paid" });
    }

    const paymentOrder = existingOrder as CallbackOrder;
    const { data: orderItems, error: itemsError } = await db
      .from("order_items")
      .select("product_type")
      .eq("order_id", orderId);

    if (itemsError || !isOnlinePaymentEligible((orderItems || []) as CallbackOrderItem[])) {
      await (db.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("process_payment_callback", {
        p_order_id: orderId,
        p_payment_status: "failed",
        p_order_status: "",
        p_transaction_id: "",
        p_payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          amount,
          error: "payment_not_eligible",
        },
        p_audit_action: `Payment rejected: ${orderId} is not eligible for online payment`,
        p_audit_details: { sale_id: saleId, amount, error: "payment_not_eligible" },
      });

      recordPaymentOutcome({ orderId, status: "failed", amount, provider: "icredit" });
      return apiError("This order is not eligible for online payment", 409);
    }

    // Replay protection: reject duplicate saleId
    if (saleId) {
      const { data: dupOrder } = await db.from("orders")
        .select("id")
        .neq("id", orderId)
        .eq("payment_transaction_id", String(saleId))
        .single();
      if (dupOrder) {
        console.warn("iCredit IPN: duplicate saleId:", saleId, "already used by order:", dupOrder.id);
        return apiError("Duplicate transaction", 409);
      }
    }

    // Verify IPN with iCredit — mandatory
    let verified = false;
    try {
      const { verifyIPN } = await import("@/lib/integrations/rivhit");
      const verifyResult = await verifyIPN(saleId, amount);
      verified = verifyResult.verified;
      if (!verified) {
        console.warn("iCredit IPN verification failed for order:", orderId);
      }
    } catch {
      console.error("iCredit IPN verification error for order:", orderId);
    }

    const isJ5 = paramJ === "5" || paramJ === 5;

    // Block unverified payments (except J5 holds)
    if (!verified && !isJ5) {
      await (db.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("process_payment_callback", {
        p_order_id: orderId,
        p_payment_status: "pending",
        p_order_status: "",
        p_transaction_id: "",
        p_payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          amount,
          verified: false,
          error: "IPN verification failed",
        },
        p_audit_action: `⚠️ دفع غير مُتحقق: ${orderId} — ₪${amount}`,
        p_audit_details: { sale_id: saleId, amount, verified: false },
      });

      recordPaymentOutcome({ orderId, status: "failed", amount, provider: "icredit" });
      return apiSuccess({ received: true, verified: false });
    }

    const orderTotal = Number(paymentOrder.total || 0);
    if (orderTotal > 0 && !amountsMatch(amount, orderTotal)) {
      await (db.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("process_payment_callback", {
        p_order_id: orderId,
        p_payment_status: "failed",
        p_order_status: "",
        p_transaction_id: "",
        p_payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          amount,
          expected: orderTotal,
          error: "amount_mismatch",
        },
        p_audit_action: `Payment amount mismatch: ${orderId} paid ${amount} instead of ${orderTotal}`,
        p_audit_details: { sale_id: saleId, paid: amount, expected: orderTotal },
      });

      recordPaymentOutcome({ orderId, status: "failed", amount, provider: "icredit" });
      return apiError("Payment amount mismatch", 409);
    }

    if (saleId && amount > 0 && !isJ5) {
      await (db.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("process_payment_callback", {
        p_order_id: orderId,
        p_payment_status: "paid",
        p_order_status: "approved",
        p_transaction_id: String(customerTransactionId || saleId),
        p_payment_details: {
          type: "credit",
          provider: "icredit",
          card: cardLast4,
          installments: numPayments,
          sale_id: saleId,
          customer_transaction_id: customerTransactionId,
          token: token,
          amount: amount,
          verified: verified,
        },
        p_audit_action: `💳 دفع ناجح: ${orderId} — ₪${amount} ${cardLast4 ? `(****${cardLast4})` : ""} ${numPayments > 1 ? `${numPayments} תשלומים` : ""}`,
        p_audit_details: {
          sale_id: saleId, customer_transaction_id: customerTransactionId,
          amount, card: cardLast4, installments: numPayments, verified,
        },
      });

      recordPaymentOutcome({ orderId, status: "succeeded", amount, provider: "icredit" });

      try {
        // Payment confirmed — send status notification (NOT duplicate new-order notification)
        const { notifyStatusChange } = await import("@/lib/bot/notifications");
        const { data: order, error: orderErr } = await db
          .from("orders")
          .select("*, customers(name, phone)")
          .eq("id", orderId)
          .maybeSingle();

        if (!orderErr && order?.customers) {
          const phone = (order.customers as any).phone;
          if (phone) {
            await notifyStatusChange(orderId, phone, "approved");
          }
        }
      } catch {
        console.error("Payment notification failed for order:", orderId);
      }
    } else if (isJ5) {
      await (db.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("process_payment_callback", {
        p_order_id: orderId,
        p_payment_status: "pending_capture",
        p_order_status: "",
        p_transaction_id: "",
        p_payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          customer_transaction_id: customerTransactionId,
          token: token,
          amount: amount,
          status: "j5_hold",
        },
        p_audit_action: `⏳ دفع معلّق (J5): ${orderId} — ₪${amount}`,
        p_audit_details: { sale_id: saleId, amount, status: "j5_hold" },
      });
      recordPaymentOutcome({ orderId, status: "pending", amount, provider: "icredit" });
    } else {
      await (db.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("process_payment_callback", {
        p_order_id: orderId,
        p_payment_status: "failed",
        p_order_status: "",
        p_transaction_id: "",
        p_payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          amount: amount,
          error: "Payment not completed",
        },
        p_audit_action: `❌ فشل الدفع: ${orderId}`,
        p_audit_details: { sale_id: saleId, amount },
      });
      recordPaymentOutcome({ orderId, status: "failed", amount, provider: "icredit" });
    }

    return apiSuccess({ received: true });
  } catch {
    console.error("iCredit IPN processing error");
    return apiError("Internal error", 500);
  }
}

export async function GET() {
  return apiSuccess({ status: "ok" });
}
