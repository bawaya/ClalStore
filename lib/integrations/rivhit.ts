// =====================================================
// ClalMobile — Rivhit Payment Provider
// Israeli payment gateway — PaymentPageRequest (hosted page)
// Docs: https://rivhit-api.readme.io/reference
// =====================================================

import type { PaymentProvider, ChargeParams, ChargeResult, PaymentStatus, RefundResult } from "./hub";
import { getIntegrationConfig } from "./hub";

const RIVHIT_API = "https://api.rivhit.co.il/online";
const RIVHIT_PAGE_API = `${RIVHIT_API}/api/PaymentPageRequest.svc/GetUrl`;

/** Read Rivhit credentials — DB first, env fallback */
async function getRivhitConfig() {
  const dbCfg = await getIntegrationConfig("payment");
  const apiKey = dbCfg.api_key || process.env.RIVHIT_API_KEY || "";
  const businessId = dbCfg.business_id || process.env.RIVHIT_BUSINESS_ID || "";
  if (!apiKey || !businessId) throw new Error("Rivhit credentials not configured");
  return { apiKey, businessId };
}

/** Build Rivhit payment page URL (hosted checkout) */
export async function createPaymentPage(params: {
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerCity?: string;
  customerAddress?: string;
  idNumber?: string;
  items: { name: string; price: number; quantity: number }[];
  maxInstallments?: number;
  language?: string;
}): Promise<{ success: boolean; paymentUrl?: string; requestId?: string; error?: string }> {
  const { apiKey, businessId } = await getRivhitConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  try {
    const res = await fetch(RIVHIT_PAGE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_token: apiKey,
        business_id: Number(businessId),
        type: 320, // חשבונית מס / קבלה
        description: `ClalMobile — طلب ${params.orderId}`,
        sum: params.amount,
        currency: "ILS",
        client_name: params.customerName,
        client_id_number: params.idNumber || "",
        client_phone: params.customerPhone,
        client_email: params.customerEmail || "",
        client_address: params.customerAddress || "",
        client_city: params.customerCity || "",
        items: params.items.map((i) => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          vat_type: 1, // כולל מע"מ
        })),
        payments_option: {
          credit_card: true,
          max_payments: params.maxInstallments || 12,
          min_payments: 1,
          bit: true,
          apple_pay: false,
          google_pay: false,
        },
        success_url: `${appUrl}/store/checkout/success?order=${params.orderId}`,
        failure_url: `${appUrl}/store/checkout/failed?order=${params.orderId}`,
        cancel_url: `${appUrl}/store/cart?cancelled=1`,
        callback_url: `${appUrl}/api/payment/callback`,
        custom_field_1: params.orderId,
        language: params.language || "ar",
        create_document: true,
        send_document_by_email: !!params.customerEmail,
        comment: `ClalMobile Order ${params.orderId}`,
      }),
    });

    const data = await res.json();

    if (data.status === 1 && data.payment_url) {
      return {
        success: true,
        paymentUrl: data.payment_url,
        requestId: data.request_id,
      };
    }

    return {
      success: false,
      error: data.error_message || `Rivhit error ${data.error_code || "unknown"}`,
    };
  } catch (err: any) {
    console.error("Rivhit PaymentPageRequest error:", err);
    return { success: false, error: err.message };
  }
}

export class RivhitProvider implements PaymentProvider {
  name = "Rivhit";

  /** Creates a hosted payment page URL — customer is redirected to Rivhit */
  async createCharge(params: ChargeParams): Promise<ChargeResult> {
    const result = await createPaymentPage({
      orderId: params.orderId,
      amount: params.amount,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      items: [{ name: params.description, price: params.amount, quantity: 1 }],
      maxInstallments: params.installments || 12,
    });

    if (result.success) {
      return {
        success: true,
        transactionId: result.requestId,
        redirectUrl: result.paymentUrl,
      };
    }

    return { success: false, error: result.error };
  }

  async verifyPayment(transactionId: string): Promise<PaymentStatus> {
    const { apiKey, businessId } = await getRivhitConfig();

    try {
      const res = await fetch(`${RIVHIT_API}/getDocumentInfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: apiKey,
          business_id: Number(businessId),
          document_id: transactionId,
        }),
      });

      const data = await res.json();
      const paid = data.status === "paid" || data.payment_status === 1;

      return {
        status: paid ? "success" : data.status === "refunded" ? "refunded" : "pending",
        transactionId,
        amount: data.total || data.sum || 0,
      };
    } catch {
      return { status: "failed", transactionId, amount: 0 };
    }
  }

  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    const { apiKey, businessId } = await getRivhitConfig();

    try {
      const res = await fetch(`${RIVHIT_API}/createRefund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: apiKey,
          business_id: Number(businessId),
          document_id: transactionId,
          amount,
        }),
      });

      const data = await res.json();

      if (data.status === "success" || data.status === 1) {
        return { success: true, refundId: data.refund_id || data.document_id };
      }

      return { success: false, error: data.error_message || "Refund failed" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
