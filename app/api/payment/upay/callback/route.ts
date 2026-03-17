export const runtime = "nodejs";

// =====================================================
// ClalMobile — UPay Payment Callback
// UPay redirects here after payment with GET params:
//   transactionid, providererrordescription, amount,
//   errormessage, errordescription, order_id
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  const orderId = params.get("order_id");
  const transactionId = params.get("transactionid");
  const status = params.get("providererrordescription");
  const errorMessage = params.get("errormessage");
  const errorDescription = params.get("errordescription");
  const amount = params.get("amount");

  console.log("[UPay Callback]", {
    orderId,
    transactionId,
    status,
    amount,
    errorMessage,
  });

  if (!orderId) {
    return NextResponse.redirect(`${appUrl}/store/cart?error=missing_order`);
  }

  const db = createAdminSupabase();

  try {
    const { data: existingOrder } = await db
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", orderId)
      .single();

    if (!existingOrder) {
      console.error("[UPay Callback] Order not found:", orderId);
      return NextResponse.redirect(
        `${appUrl}/store/checkout/failed?order=${orderId}&error=not_found`
      );
    }

    if (existingOrder.payment_status === "paid") {
      return NextResponse.redirect(
        `${appUrl}/store/checkout/success?order=${orderId}`
      );
    }

    if (errorMessage) {
      console.error("[UPay Callback] Error:", errorMessage, errorDescription);
      await db
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

      await db.from("audit_log").insert({
        user_name: "UPay",
        action: `❌ فشل الدفع: ${orderId} — ${errorMessage}`,
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
      console.error("[UPay Callback] Invalid response:", { transactionId, status });
      await db
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

    // Payment successful
    const parsedAmount = amount ? parseFloat(amount) : 0;

    await db
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
        },
      })
      .eq("id", orderId);

    await db.from("audit_log").insert({
      user_name: "UPay",
      action: `💳 دفع ناجح: ${orderId} — ₪${parsedAmount}`,
      entity_type: "payment",
      entity_id: orderId,
      details: { transactionId, amount: parsedAmount, status },
    });

    try {
      const { notifyNewOrder } = await import("@/lib/bot/notifications");
      const { data: order } = await db
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
      }
    } catch (notifErr) {
      console.error("[UPay] Notification error:", notifErr);
    }

    return NextResponse.redirect(
      `${appUrl}/store/checkout/success?order=${orderId}&value=${parsedAmount}`
    );
  } catch (err: any) {
    console.error("[UPay Callback] Error:", err);
    return NextResponse.redirect(
      `${appUrl}/store/checkout/failed?order=${orderId}&error=internal`
    );
  }
}
