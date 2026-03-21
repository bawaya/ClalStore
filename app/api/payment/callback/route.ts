export const runtime = 'edge';

// =====================================================
// ClalMobile — iCredit IPN Callback
// iCredit sends POST with sale results after payment
// IPN fields: GroupPrivateToken, SaleId, CustomerTransactionId,
//   TransactionAmount, TransactionToken, NumberOfPayments,
//   CardLastFourDigits, Custom1 (orderId), etc.
// Docs: https://rivhit-api.readme.io/docs/ipn-by-sale-types
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, any>;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
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
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    const db = createAdminSupabase();

    const { data: existingOrder } = await db.from("orders")
      .select("id, status, payment_status")
      .eq("id", orderId)
      .single();

    if (!existingOrder) {
      console.error("iCredit IPN: order not found:", orderId);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (existingOrder.payment_status === "paid") {
      console.warn("iCredit IPN: order already paid:", orderId);
      return NextResponse.json({ received: true, note: "already_paid" });
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
    } catch (verifyErr) {
      console.error("iCredit IPN verification error for order:", orderId);
    }

    const isJ5 = paramJ === "5" || paramJ === 5;

    // Block unverified payments (except J5 holds)
    if (!verified && !isJ5) {
      await db.from("orders").update({
        payment_status: "pending",
        payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          amount,
          verified: false,
          error: "IPN verification failed",
        },
      }).eq("id", orderId);

      await db.from("audit_log").insert({
        user_name: "iCredit",
        action: `⚠️ دفع غير مُتحقق: ${orderId} — ₪${amount}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { sale_id: saleId, amount, verified: false },
      });

      return NextResponse.json({ received: true, verified: false });
    }

    if (saleId && amount > 0 && !isJ5) {
      await db.from("orders").update({
        payment_status: "paid",
        payment_transaction_id: String(customerTransactionId || saleId),
        status: "approved",
        payment_details: {
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
      }).eq("id", orderId);

      await db.from("audit_log").insert({
        user_name: "iCredit",
        action: `💳 دفع ناجح: ${orderId} — ₪${amount} ${cardLast4 ? `(****${cardLast4})` : ""} ${numPayments > 1 ? `${numPayments} תשלומים` : ""}`,
        entity_type: "payment",
        entity_id: orderId,
        details: {
          sale_id: saleId, customer_transaction_id: customerTransactionId,
          amount, card: cardLast4, installments: numPayments, verified,
        },
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
            amount,
            "icredit_payment"
          );

          const { notifyAdminNewOrder } = await import("@/lib/bot/admin-notify");
          await notifyAdminNewOrder({
            orderId,
            customerName: (order.customers as any).name || "زبون",
            customerPhone: (order.customers as any).phone || "",
            total: Number(amount || 0),
            source: "icredit_payment",
            items: [{ name: "Payment callback", qty: 1, price: Number(amount || 0) }],
          });
        }
      } catch (notifErr) {
        console.error("Payment notification failed for order:", orderId);
      }
    } else if (isJ5) {
      await db.from("orders").update({
        payment_status: "pending_capture",
        payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          customer_transaction_id: customerTransactionId,
          token: token,
          amount: amount,
          status: "j5_hold",
        },
      }).eq("id", orderId);

      await db.from("audit_log").insert({
        user_name: "iCredit",
        action: `⏳ دفع معلّق (J5): ${orderId} — ₪${amount}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { sale_id: saleId, amount, status: "j5_hold" },
      });
    } else {
      await db.from("orders").update({
        payment_status: "failed",
        payment_details: {
          type: "credit",
          provider: "icredit",
          sale_id: saleId,
          amount: amount,
          error: "Payment not completed",
        },
      }).eq("id", orderId);

      await db.from("audit_log").insert({
        user_name: "iCredit",
        action: `❌ فشل الدفع: ${orderId}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { sale_id: saleId, amount },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("iCredit IPN processing error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
