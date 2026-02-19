export const runtime = 'edge';

// =====================================================
// ClalMobile — Payment Callback
// POST: Rivhit calls this after payment on hosted page
// Fields: status, request_id, document_id, custom_field_1 (orderId),
//         sum, transaction_id, last_4_digits, number_of_payments
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("Rivhit callback received:", JSON.stringify(body, null, 2));

    const {
      status,
      request_id,
      document_id,
      document_number,
      sum,
      transaction_id,
      last_4_digits,
      number_of_payments,
      payment_type,
      custom_field_1, // orderId
      error_code,
      error_message,
    } = body;

    // Extract order ID from custom_field_1 or comment
    const orderId = custom_field_1 || body.comment?.match(/CLM-\d{5}/)?.[0];

    if (!orderId) {
      console.error("Payment callback: missing order ID", body);
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    const db = createAdminSupabase();

    if (status === 1) {
      // === Payment Successful ===
      const paymentMethod =
        payment_type === 10 ? "bit" :
        payment_type === 11 ? "apple_pay" :
        payment_type === 4 ? "bank_transfer" : "credit";

      await db.from("orders").update({
        payment_status: "paid",
        payment_transaction_id: String(document_id || transaction_id || request_id),
        status: "approved",
        payment_details: {
          type: paymentMethod,
          card: last_4_digits || "",
          installments: number_of_payments || 1,
          document_id: document_id,
          document_number: document_number,
          transaction_id: transaction_id,
          amount: sum,
          rivhit_request_id: request_id,
        },
      }).eq("id", orderId);

      // Audit log
      await db.from("audit_log").insert({
        user_name: "Rivhit",
        action: `💳 دفع ناجح: ${orderId} — ₪${sum} ${last_4_digits ? `(****${last_4_digits})` : ""} ${number_of_payments > 1 ? `${number_of_payments} תשלומים` : ""}`,
        entity_type: "payment",
        entity_id: orderId,
        details: {
          document_id, transaction_id, sum,
          last_4_digits, number_of_payments, payment_type,
        },
      });

      // WhatsApp notification for successful payment
      try {
        const { notifyNewOrder } = await import("@/lib/bot/notifications");
        // Re-fetch order to get customer info
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
            sum,
            "rivhit_payment"
          );
        }
      } catch (notifErr) {
        console.error("Payment notification failed:", notifErr);
      }
    } else {
      // === Payment Failed ===
      await db.from("orders").update({
        payment_status: "failed",
        payment_details: {
          type: "credit",
          error_code,
          error_message,
          rivhit_request_id: request_id,
        },
      }).eq("id", orderId);

      await db.from("audit_log").insert({
        user_name: "Rivhit",
        action: `❌ فشل الدفع: ${orderId} — ${error_message || "خطأ غير معروف"}`,
        entity_type: "payment",
        entity_id: orderId,
        details: { error_code, error_message, request_id },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Payment callback error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Rivhit may also send GET for verification
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: "ok" });
}
