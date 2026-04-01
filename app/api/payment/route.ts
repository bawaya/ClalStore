
// =====================================================
// ClalMobile — Payment API (Dual Gateway)
// POST: Create hosted payment page URL
// Auto-routes based on customer city:
//   Israeli city → Rivhit (iCredit)
//   Palestinian / other → UPay
// =====================================================

import { NextRequest } from "next/server";
import { getIntegrationConfig } from "@/lib/integrations/hub";
import { detectPaymentGateway } from "@/lib/payment-gateway";
import { apiSuccess, apiError } from "@/lib/api-response";
import { paymentSchema, validateBody } from "@/lib/admin/validators";

export async function POST(req: NextRequest) {
  try {
    const v = validateBody(await req.json(), paymentSchema);
    if (!v.success) return apiError(v.error, 400);
    const {
      orderId, amount, customerName, customerPhone, customerEmail,
      customerCity, customerAddress, idNumber, items, maxInstallments,
      forceGateway,
    } = v.data;

    const gateway = forceGateway || detectPaymentGateway(customerCity || "");
    // Payment gateway selected

    if (gateway === "rivhit") {
      const rivhitCfg = await getIntegrationConfig("payment");
      if (!rivhitCfg.group_private_token && !process.env.ICREDIT_GROUP_PRIVATE_TOKEN) {
        return apiError("بوابة iCredit غير مهيأة — أدخل GroupPrivateToken في الإعدادات", 503);
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
        return apiSuccess({
          paymentUrl: result.paymentUrl,
          privateSaleToken: result.privateSaleToken,
          provider: "icredit",
        });
      }
      return apiError(result.error || "Payment failed", 400);
    }

    // UPay gateway
    const upayCfg = await getIntegrationConfig("payment_upay");
    if (!upayCfg.api_username && !process.env.UPAY_API_USERNAME) {
      return apiError("بوابة UPay غير مهيأة", 503);
    }
    const { createUpayPaymentPage } = await import("@/lib/integrations/upay");
    const result = await createUpayPaymentPage({
      orderId, amount, customerEmail, customerPhone,
    });

    if (result.success) {
      return apiSuccess({ paymentUrl: result.paymentUrl, provider: "upay" });
    }
    return apiError(result.error || "Payment failed", 400);
  } catch (err: unknown) {
    console.error("Payment API error:", err);
    return apiError("حدث خطأ في معالجة الدفع", 500);
  }
}
