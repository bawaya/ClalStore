
import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { authenticateCustomer } from "@/lib/customer-auth";

const TRACKING_LOOKUP_ERROR = "تعذر التحقق من الطلب";

const orderStatusQuerySchema = z.object({
  orderId: z.string().trim().toUpperCase().regex(/^CLM-(\d{5}|[A-Z0-9]{8})$/),
  verification: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  phoneSuffix: z.string().trim().optional(),
  email: z.string().trim().optional(),
  customerCode: z.string().trim().optional(),
});

type TrackingCustomer = {
  id?: string | null;
  phone?: string | null;
  email?: string | null;
  customer_code?: string | null;
};

type TrackingOrder = {
  id: string;
  customer_id?: string | null;
  status: string;
  total: number;
  created_at: string;
  payment_status?: string | null;
  customers?: TrackingCustomer | null;
};

function normalizePhone(phone?: string | null) {
  return String(phone || "").replace(/[\s\-+]/g, "");
}

function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

function normalizeCode(code?: string | null) {
  return String(code || "").trim().toUpperCase();
}

function matchesPublicVerification(customer: TrackingCustomer | null | undefined, input: {
  verification?: string;
  phone?: string;
  phoneSuffix?: string;
  email?: string;
  customerCode?: string;
}) {
  if (!customer) return false;

  const dbPhone = normalizePhone(customer.phone);
  const dbEmail = normalizeEmail(customer.email);
  const dbCustomerCode = normalizeCode(customer.customer_code);
  const verification = String(input.verification || "").trim();
  const digitsOnlyVerification = normalizePhone(verification);

  const phone = normalizePhone(input.phone);
  if (dbPhone && phone && dbPhone === phone) return true;

  const phoneSuffix = normalizePhone(input.phoneSuffix);
  if (dbPhone && phoneSuffix.length >= 4 && dbPhone.endsWith(phoneSuffix)) return true;

  if (dbPhone && digitsOnlyVerification.length >= 4 && dbPhone.endsWith(digitsOnlyVerification)) {
    return true;
  }

  const email = normalizeEmail(input.email || verification);
  if (dbEmail && email && dbEmail === email) return true;

  const customerCode = normalizeCode(input.customerCode || verification);
  return Boolean(dbCustomerCode && customerCode && dbCustomerCode === customerCode);
}

export async function GET(req: NextRequest) {
  try {
    const parsed = orderStatusQuerySchema.safeParse({
      orderId: req.nextUrl.searchParams.get("orderId") || "",
      verification: req.nextUrl.searchParams.get("verification") || undefined,
      phone: req.nextUrl.searchParams.get("phone") || undefined,
      phoneSuffix: req.nextUrl.searchParams.get("phoneSuffix") || undefined,
      email: req.nextUrl.searchParams.get("email") || undefined,
      customerCode: req.nextUrl.searchParams.get("customerCode") || undefined,
    });

    if (!parsed.success) {
      return apiError(TRACKING_LOOKUP_ERROR, 400);
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("خطأ في الاتصال", 500);
    }

    const hasPublicFactor = Boolean(
      parsed.data.verification ||
        parsed.data.phone ||
        parsed.data.phoneSuffix ||
        parsed.data.email ||
        parsed.data.customerCode,
    );
    const hasAuthHeader = req.headers.get("authorization")?.startsWith("Bearer ");
    const authenticatedCustomer = hasAuthHeader ? await authenticateCustomer(req) : null;

    if (!hasPublicFactor && !authenticatedCustomer) {
      return apiError(TRACKING_LOOKUP_ERROR, 400);
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_id, status, total, created_at, payment_status, customers(id, phone, email, customer_code)")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (error || !order) {
      return apiError(TRACKING_LOOKUP_ERROR, 404);
    }

    const trackingOrder = order as TrackingOrder;
    const customer = trackingOrder.customers || null;
    const authCustomerId = authenticatedCustomer
      ? String((authenticatedCustomer as { id?: string }).id || "")
      : "";
    const orderCustomerId = String(trackingOrder.customer_id || customer?.id || "");

    const authMatches = Boolean(authCustomerId && orderCustomerId && authCustomerId === orderCustomerId);
    const publicFactorMatches = matchesPublicVerification(customer, parsed.data);

    if (!authMatches && !publicFactorMatches) {
      return apiError(TRACKING_LOOKUP_ERROR, 404);
    }

    return apiSuccess({
      order: {
        id: trackingOrder.id,
        status: trackingOrder.status,
        total: trackingOrder.total,
        created_at: trackingOrder.created_at,
        payment_status: trackingOrder.payment_status,
      },
    });
  } catch {
    return apiError("حدث خطأ", 500);
  }
}
