
// =====================================================
// ClalMobile — Payment API (Dual Gateway)
// POST: Create hosted payment page URL
// Auto-routes based on customer city:
//   Israeli city → Rivhit (iCredit)
//   Palestinian / other → UPay
// =====================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getIntegrationConfig } from "@/lib/integrations/hub";
import { detectPaymentGateway } from "@/lib/payment-gateway";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { authenticateCustomer } from "@/lib/customer-auth";

const paymentRequestSchema = z.object({
  orderId: z.string().trim().toUpperCase().regex(/^CLM-\d{5}$/),
  amount: z.coerce.number().positive(),
  customerPhone: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
}).passthrough();

const PAYMENT_REUSE_WINDOW_MS = 15 * 60_000;

type PaymentCustomer = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  id_number?: string | null;
};

type PaymentOrder = {
  id: string;
  customer_id?: string | null;
  status?: string | null;
  total?: number | string | null;
  payment_status?: string | null;
  payment_details?: Record<string, unknown> | null;
  shipping_city?: string | null;
  shipping_address?: string | null;
  customers?: PaymentCustomer | null;
};

type PaymentOrderItem = {
  product_name?: string | null;
  product_type?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
};

function normalizePhone(phone?: string | null) {
  return String(phone || "").replace(/[\s\-+]/g, "");
}

function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

function amountsMatch(clientAmount: number, serverAmount: number) {
  return Math.abs(clientAmount - serverAmount) < 0.01;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getReusablePaymentAttempt(paymentDetails: Record<string, unknown>, amount: number) {
  const attempt = paymentDetails.payment_attempt;
  if (!isRecord(attempt)) return null;

  const paymentUrl = typeof attempt.payment_url === "string" ? attempt.payment_url : "";
  const provider = typeof attempt.provider === "string" ? attempt.provider : "";
  const attemptedAmount = Number(attempt.amount);
  const initiatedAt =
    typeof attempt.initiated_at === "string" ? new Date(attempt.initiated_at).getTime() : 0;

  if (!paymentUrl || !provider || !amountsMatch(attemptedAmount, amount)) return null;
  if (!Number.isFinite(initiatedAt) || Date.now() - initiatedAt > PAYMENT_REUSE_WINDOW_MS) {
    return null;
  }

  return { paymentUrl, provider };
}

function customerMatchesRequest(
  customer: PaymentCustomer | null | undefined,
  requestedPhone?: string,
  requestedEmail?: string,
) {
  if (!customer) return false;

  const dbPhone = normalizePhone(customer.phone);
  const bodyPhone = normalizePhone(requestedPhone);
  if (dbPhone && bodyPhone && dbPhone === bodyPhone) return true;

  const dbEmail = normalizeEmail(customer.email);
  const bodyEmail = normalizeEmail(requestedEmail);
  return Boolean(dbEmail && bodyEmail && dbEmail === bodyEmail);
}

function getSavedMaxInstallments(paymentDetails: Record<string, unknown>) {
  const value = Number(paymentDetails.installments || paymentDetails.maxInstallments);
  if (Number.isInteger(value) && value >= 1 && value <= 12) return value;
  return 12;
}

function isOnlinePaymentEligible(items: PaymentOrderItem[]) {
  return items.length > 0 && items.every((item) => item.product_type === "accessory");
}

export async function POST(req: NextRequest) {
  try {
    const parsed = paymentRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("بيانات الدفع غير صالحة", 400);
    }

    const { orderId, amount, customerPhone, customerEmail } = parsed.data;

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("خطأ في إعدادات السيرفر", 500);
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, customer_id, status, total, payment_status, payment_details, shipping_city, shipping_address, customers(id, name, phone, email, city, address, id_number)",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return apiError("تعذر بدء الدفع لهذا الطلب", 404);
    }

    const paymentOrder = order as PaymentOrder;
    const customer = paymentOrder.customers || null;
    const serverAmount = Number(paymentOrder.total);

    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return apiError("تعذر بدء الدفع لهذا الطلب", 409);
    }

    if (!amountsMatch(amount, serverAmount)) {
      return apiError("مبلغ الدفع لا يطابق الطلب", 409);
    }

    if (["cancelled", "rejected"].includes(String(paymentOrder.status || ""))) {
      return apiError("لا يمكن الدفع لهذا الطلب", 409);
    }

    if (paymentOrder.payment_status === "paid") {
      return apiError("تم دفع هذا الطلب مسبقاً", 409);
    }

    const authenticatedCustomer = await authenticateCustomer(req);
    if (authenticatedCustomer) {
      const authCustomerId = String((authenticatedCustomer as { id?: string }).id || "");
      const orderCustomerId = String(paymentOrder.customer_id || customer?.id || "");
      if (!authCustomerId || !orderCustomerId || authCustomerId !== orderCustomerId) {
        return apiError("غير مصرح بالدفع لهذا الطلب", 403);
      }
    } else if (!customerMatchesRequest(customer, customerPhone, customerEmail)) {
      return apiError("تعذر التحقق من ملكية الطلب", 403);
    }

    const paymentDetails = isRecord(paymentOrder.payment_details)
      ? paymentOrder.payment_details
      : {};
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name, product_type, price, quantity")
      .eq("order_id", paymentOrder.id);

    if (itemsError || !orderItems || orderItems.length === 0) {
      return apiError("This order is not eligible for online payment", 409);
    }

    const typedOrderItems = orderItems as PaymentOrderItem[];
    if (!isOnlinePaymentEligible(typedOrderItems)) {
      return apiError("This order is not eligible for online payment", 409);
    }

    const reusableAttempt = getReusablePaymentAttempt(paymentDetails, serverAmount);
    if (reusableAttempt) {
      return apiSuccess({
        paymentUrl: reusableAttempt.paymentUrl,
        provider: reusableAttempt.provider,
        reused: true,
      });
    }

    const gatewayItems = typedOrderItems.map((item) => ({
      name: item.product_name || `طلب ${paymentOrder.id}`,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    }));

    const customerName = customer?.name || `طلب ${paymentOrder.id}`;
    const dbCustomerPhone = customer?.phone || customerPhone || "";
    const dbCustomerEmail = customer?.email || customerEmail || undefined;
    const customerCity = paymentOrder.shipping_city || customer?.city || "";
    const customerAddress = paymentOrder.shipping_address || customer?.address || "";
    const idNumber = customer?.id_number || undefined;
    const maxInstallments = getSavedMaxInstallments(paymentDetails);
    const gateway = detectPaymentGateway(customerCity);

    const rememberPaymentAttempt = async (
      provider: string,
      paymentUrl?: string,
      privateSaleToken?: string,
    ) => {
      if (!paymentUrl) return;
      const nextPaymentDetails = {
        ...paymentDetails,
        payment_attempt: {
          provider,
          amount: serverAmount,
          payment_url: paymentUrl,
          private_sale_token: privateSaleToken,
          initiated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("orders")
        .update({ payment_details: nextPaymentDetails })
        .eq("id", paymentOrder.id);

      if (error) {
        console.error("Payment attempt persistence failed:", error);
      }
    };

    if (gateway === "rivhit") {
      const rivhitCfg = await getIntegrationConfig("payment");
      if (!rivhitCfg.group_private_token && !process.env.ICREDIT_GROUP_PRIVATE_TOKEN) {
        return apiError("بوابة iCredit غير مهيأة — أدخل GroupPrivateToken في الإعدادات", 503);
      }
      const { createPaymentPage } = await import("@/lib/integrations/rivhit");
      const result = await createPaymentPage({
        orderId: paymentOrder.id,
        amount: serverAmount,
        customerName,
        customerPhone: dbCustomerPhone,
        customerEmail: dbCustomerEmail,
        customerCity, customerAddress, idNumber,
        items: gatewayItems,
        maxInstallments,
        language: "ar",
      });

      if (result.success) {
        await rememberPaymentAttempt("icredit", result.paymentUrl, result.privateSaleToken);
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
      orderId: paymentOrder.id,
      amount: serverAmount,
      customerEmail: dbCustomerEmail,
      customerPhone: dbCustomerPhone,
    });

    if (result.success) {
      await rememberPaymentAttempt("upay", result.paymentUrl);
      return apiSuccess({ paymentUrl: result.paymentUrl, provider: "upay" });
    }
    return apiError(result.error || "Payment failed", 400);
  } catch (err: unknown) {
    console.error("Payment API error:", err);
    return apiError("حدث خطأ في معالجة الدفع", 500);
  }
}
