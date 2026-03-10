export const runtime = 'edge';

// =====================================================
// ClalMobile — Payment API (Dual Gateway)
// POST: Create hosted payment page URL
// Auto-routes based on customer city:
//   Israeli city → Rivhit (iCredit)
//   Palestinian / other → UPay
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getIntegrationConfig } from "@/lib/integrations/hub";
import { detectPaymentGateway } from "@/lib/payment-gateway";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId, amount, customerName, customerPhone, customerEmail,
      customerCity, customerAddress, idNumber, items, maxInstallments,
      forceGateway,
    } = body;

    if (!orderId || !amount || !customerName || !customerPhone) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const gateway = forceGateway || detectPaymentGateway(customerCity || "");
    console.log(`[Payment] city="${customerCity}" → gateway=${gateway}`);

    if (gateway === "rivhit") {
      const rivhitCfg = await getIntegrationConfig("payment");
      if (!rivhitCfg.api_key && !process.env.RIVHIT_API_KEY) {
        return NextResponse.json({ error: "بوابة Rivhit غير مهيأة" }, { status: 503 });
      }
      const { createPaymentPage } = await import("@/lib/integrations/rivhit");
      const result = await createPaymentPage({
        orderId, amount, customerName, customerPhone, customerEmail,
        customerCity, customerAddress, idNumber,
        items: items || [{ name: `طلب ${orderId}`, price: amount, quantity: 1 }],
        maxInstallments: maxInstallments || 12,
        language: "ar",
      });

      if (result.success) {
        return NextResponse.json({
          success: true, paymentUrl: result.paymentUrl,
          requestId: result.requestId, provider: "rivhit",
        });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // UPay gateway
    const upayCfg = await getIntegrationConfig("payment_upay");
    if (!upayCfg.api_username && !process.env.UPAY_API_USERNAME) {
      return NextResponse.json({ error: "بوابة UPay غير مهيأة" }, { status: 503 });
    }
    const { createUpayPaymentPage } = await import("@/lib/integrations/upay");
    const result = await createUpayPaymentPage({
      orderId, amount, customerEmail, customerPhone,
    });

    if (result.success) {
      return NextResponse.json({ success: true, paymentUrl: result.paymentUrl, provider: "upay" });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  } catch (err: any) {
    console.error("Payment API error:", err);
    return NextResponse.json({ error: "حدث خطأ في معالجة الدفع" }, { status: 500 });
  }
}
