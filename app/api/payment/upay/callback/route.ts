
// =====================================================
// ClalMobile — UPay Payment Callback
// UPay redirects here after payment with GET params:
//   transactionid, providererrordescription, amount,
//   errormessage, errordescription, order_id
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { getPublicSiteUrl } from "@/lib/public-site-url";

type CallbackOrderItem = {
  product_type?: string | null;
};

function isOnlinePaymentEligible(items: CallbackOrderItem[]) {
  return items.length > 0 && items.every((item) => item.product_type === "accessory");
}

async function buildSuccessRedirect(
  appUrl: string,
  orderId: string,
  value?: number,
) {
  const params = new URLSearchParams({ order: orderId });

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    params.set("value", String(value));
  }

  const supabase = createAdminSupabase();
  if (supabase) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, customers(customer_code)")
      .eq("id", orderId)
      .maybeSingle();

    const customerCode = (order?.customers as { customer_code?: string } | null)?.customer_code;
    if (customerCode) {
      params.set("customer_code", customerCode);
    }
  }

  return `${appUrl}/store/checkout/success?${params.toString()}`;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const appUrl = getPublicSiteUrl();

  const orderId = params.get("order_id");
  const transactionId = params.get("transactionid");
  const status = params.get("providererrordescription");
  const errorMessage = params.get("errormessage");
  const errorDescription = params.get("errordescription");
  const amount = params.get("amount");

  if (!orderId) {
    return NextResponse.redirect(`${appUrl}/store/cart?error=missing_order`);
  }

  const supabase = createAdminSupabase();

  try {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, status, payment_status, total")
      .eq("id", orderId)
      .single();

    if (!existingOrder) {
      console.error("[UPay Callback] Order not found:", orderId);
      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}&error=not_found`
      );
    }

    if (existingOrder.payment_status === "paid") {
      return NextResponse.redirect(await buildSuccessRedirect(appUrl, orderId));
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("product_type")
      .eq("order_id", orderId);

    if (itemsError || !isOnlinePaymentEligible((orderItems || []) as CallbackOrderItem[])) {
      console.error("[UPay Callback] Order is not eligible for online payment:", orderId);
      await supabase.from("orders").update({
        payment_status: "failed",
        payment_details: {
          provider: "upay",
          transaction_id: transactionId,
          error: "payment_not_eligible",
        },
      }).eq("id", orderId);

      await supabase.from("audit_log").insert({
        user_name: "UPay",
        action: `Payment rejected: ${orderId} is not eligible for online payment`,
        entity_type: "payment",
        entity_id: orderId,
        details: { transactionId, error: "payment_not_eligible" },
      });

      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}&error=payment_not_eligible`
      );
    }

    if (errorMessage) {
      console.error("[UPay Callback] Payment error for order:", orderId);
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          payment_details: {
            provider: "upay",
            error_message: errorMessage,
            error_description: errorDescription,
          },
        })
        .eq("id", orderId);

      await supabase.from("audit_log").insert({
        user_name: "UPay",
        action: `❌ فشل الدفع: ${orderId}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { errorMessage, errorDescription },
      });

      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}`
      );
    }

    if (
      !transactionId ||
      (status !== "SUCCESS" && status !== "APPROVED")
    ) {
      console.error("[UPay Callback] Invalid status for order:", orderId);
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          payment_details: {
            provider: "upay",
            status,
            transaction_id: transactionId,
          },
        })
        .eq("id", orderId);

      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}`
      );
    }

    // --- Server-side verification with UPay API ---
    const { verifyUpayTransaction } = await import("@/lib/integrations/upay");
    const verification = await verifyUpayTransaction(transactionId, orderId);

    if (!verification.valid) {
      console.error("[UPay Callback] Verification failed for order:", orderId, verification.error);
      await supabase.from("orders").update({
        payment_status: "failed",
        payment_details: {
          provider: "upay",
          transaction_id: transactionId,
          verification_error: verification.error,
        },
      }).eq("id", orderId);

      await supabase.from("audit_log").insert({
        user_name: "UPay",
        action: `❌ فشل التحقق من الدفع: ${orderId}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { transactionId, error: verification.error },
      });

      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}&error=verification_failed`
      );
    }

    // Use server-verified amount, not the query param
    const parsedAmount = verification.amount || (amount ? parseFloat(amount) : 0);

    // Validate amount matches order total (allow small rounding diff)
    const orderTotal = Number(existingOrder.total || 0);
    if (orderTotal > 0 && Math.abs(parsedAmount - orderTotal) > 1) {
      console.error("[UPay Callback] Amount mismatch for order:", orderId);
      await supabase.from("orders").update({
        payment_status: "failed",
        payment_details: {
          provider: "upay",
          transaction_id: transactionId,
          error: "amount_mismatch",
          paid: parsedAmount,
          expected: orderTotal,
        },
      }).eq("id", orderId);

      await supabase.from("audit_log").insert({
        user_name: "UPay",
        action: `❌ مبلغ الدفع لا يطابق الطلب: ${orderId} — دفع ₪${parsedAmount} بدل ₪${orderTotal}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { transactionId, paid: parsedAmount, expected: orderTotal },
      });

      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}&error=amount_mismatch`
      );
    }

    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_transaction_id: transactionId,
        status: "approved",
        payment_details: {
          provider: "upay",
          type: "credit",
          transaction_id: transactionId,
          amount: parsedAmount,
          upay_status: status,
          verified: true,
        },
      })
      .eq("id", orderId);

    await supabase.from("audit_log").insert({
      user_name: "UPay",
      action: `💳 دفع ناجح: ${orderId} — ₪${parsedAmount}`,
      entity_type: "payment",
      entity_id: orderId,
      details: { transactionId, amount: parsedAmount, status },
    });

    try {
      const { notifyNewOrder } = await import("@/lib/bot/notifications");
      const { data: order } = await supabase
        .from("orders")
        .select("*, customers(name, phone)")
        .eq("id", orderId)
        .single();

      if (order?.customers) {
        await notifyNewOrder(
          orderId,
          (order.customers as any).name,
          (order.customers as any).phone,
          parsedAmount,
          "upay_payment"
        );

        const { notifyAdminNewOrder } = await import("@/lib/bot/admin-notify");
        await notifyAdminNewOrder({
          orderId,
          customerName: (order.customers as any).name || "زبون",
          customerPhone: (order.customers as any).phone || "",
          total: Number(parsedAmount || 0),
          source: "upay_payment",
          items: [{ name: "Payment callback", qty: 1, price: Number(parsedAmount || 0) }],
        });
      }
    } catch {
      console.error("[UPay] Notification error for order:", orderId);
    }

    return NextResponse.redirect(await buildSuccessRedirect(appUrl, orderId, parsedAmount));
  } catch {
    console.error("[UPay Callback] Internal error for order:", orderId);
    return NextResponse.redirect(
      `${appUrl}/store/checkout/failed?order=${orderId}&error=internal`
    );
  }
}
