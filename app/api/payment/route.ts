// =====================================================
// ClalMobile — Payment API
// POST: Create Rivhit hosted payment page URL
// Flow: Order created → call this → redirect to Rivhit
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createPaymentPage } from "@/lib/integrations/rivhit";
import { getIntegrationConfig } from "@/lib/integrations/hub";

export async function POST(req: NextRequest) {
  try {
    // Check Rivhit credentials (DB or env)
    const paymentCfg = await getIntegrationConfig("payment");
    if (!paymentCfg.api_key && !process.env.RIVHIT_API_KEY) {
      return NextResponse.json({ error: "بوابة الدفع غير مهيأة" }, { status: 503 });
    }

    const body = await req.json();
    const {
      orderId, amount, customerName, customerPhone, customerEmail,
      customerCity, customerAddress, idNumber, items, maxInstallments,
    } = body;

    if (!orderId || !amount || !customerName || !customerPhone) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const result = await createPaymentPage({
      orderId,
      amount,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      customerAddress,
      idNumber,
      items: items || [{ name: `طلب ${orderId}`, price: amount, quantity: 1 }],
      maxInstallments: maxInstallments || 12,
      language: "ar",
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        paymentUrl: result.paymentUrl,
        requestId: result.requestId,
      });
    }

    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  } catch (err: any) {
    console.error("Payment API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
