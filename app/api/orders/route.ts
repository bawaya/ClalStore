
// =====================================================
// ClalMobile — POST /api/orders
// Creates order + customer in Supabase
// Triggers: audit log, customer stats (via DB trigger)
// Future: email notification, WhatsApp alert
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { generateCustomerCode, generateOrderId, validatePhone, validateIsraeliID } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { orderSchema, validateBody } from "@/lib/admin/validators";
import type { Product } from "@/types/database";
import type { EmailProvider } from "@/lib/integrations/hub";

interface CartItem {
  productId?: string;
  name: string;
  brand: string;
  type: string;
  price: number;
  quantity?: number;
  color?: string;
  storage?: string;
  productName?: string;
}

interface OrderRequestBody {
  customer: {
    name: string;
    phone: string;
    city: string;
    address: string;
    email?: string;
    idNumber?: string;
    notes?: string;
  };
  items: CartItem[];
  payment?: Record<string, unknown>;
  couponCode?: string;
  discountAmount?: number;
  source?: string;
}

function isOnlinePaymentEligible(items: CartItem[]) {
  return items.length > 0 && items.every((item) => item.type === "accessory");
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const validation = validateBody(raw, orderSchema);
    if (validation.error) {
      return apiError("بيانات ناقصة", 400);
    }
    const body: OrderRequestBody = validation.data! as OrderRequestBody;
    const { customer, items, payment, couponCode, discountAmount: _discountAmount, source } = body;

    if (!validatePhone(customer.phone)) {
      return apiError("رقم هاتف غير صالح", 400);
    }

    // Per-phone rate limit: max 5 orders per hour
    const cleanPhoneRL = customer.phone.replace(/[-\s]/g, "");
    const rl = checkRateLimit(
      getRateLimitKey(cleanPhoneRL, "order"),
      { maxRequests: 5, windowMs: 3600_000 }
    );
    if (!rl.allowed) {
      return apiError("طلبات كثيرة — حاول بعد قليل", 429);
    }

    if (!items || items.length === 0) {
      return apiError("السلة فارغة", 400);
    }

    // 5.3.2: Reject items without product_id to prevent price tampering
    const invalidItems = items.filter((i: CartItem) => !i.productId);
    if (invalidItems.length > 0) {
      return apiError("عناصر غير صالحة — يجب أن يحتوي كل منتج على معرّف", 400);
    }

    const onlinePaymentEligible = isOnlinePaymentEligible(items);
    const requiresManualCompletion = !onlinePaymentEligible;
    if (requiresManualCompletion && customer.idNumber && !validateIsraeliID(customer.idNumber)) {
      return apiError("رقم هوية غير صالح", 400);
    }

    const supabase = createAdminSupabase();

    if (!supabase) {
      console.error("Order API: Supabase admin client is null — check SUPABASE_SERVICE_ROLE_KEY");
      return apiError("خطأ في إعدادات السيرفر", 500);
    }

    // === 1. Upsert Customer ===
    const cleanPhone = customer.phone.replace(/[-\s]/g, "");

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, customer_code")
      .eq("phone", cleanPhone)
      .maybeSingle();

    let customerId: string;
    let customerCode: string | null = existingCustomer?.customer_code || null;
    let isNewCustomer = false;

    const upsertCustomerDetails = {
      name: customer.name,
      email: customer.email || undefined,
      city: customer.city,
      address: customer.address,
      id_number: customer.idNumber || undefined,
    };

    const assignMissingCustomerCode = async (targetCustomerId: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = generateCustomerCode();
        const { error } = await supabase
          .from("customers")
          .update({ customer_code: candidate })
          .eq("id", targetCustomerId)
          .is("customer_code", null);

        if (!error) {
          return candidate;
        }

        if ((error as { code?: string }).code !== "23505") {
          console.error("Customer code assignment error:", error);
          break;
        }
      }

      return null;
    };

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer info
      await supabase
        .from("customers")
        .update(upsertCustomerDetails)
        .eq("id", customerId);

      if (!customerCode) {
        customerCode = await assignMissingCustomerCode(customerId);
      }
    } else {
      isNewCustomer = true;

      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = generateCustomerCode();
        const { data: newCustomer, error: custErr } = await supabase
          .from("customers")
          .insert({
            ...upsertCustomerDetails,
            phone: cleanPhone,
            segment: "new",
            customer_code: candidate,
          } as Record<string, unknown>)
          .select("id, customer_code")
          .single();

        if (!custErr && newCustomer) {
          customerId = newCustomer.id;
          customerCode = newCustomer.customer_code || candidate;
          break;
        }

        if ((custErr as { code?: string }).code === "23505") {
          const { data: raceCustomer } = await supabase
            .from("customers")
            .select("id, customer_code")
            .eq("phone", cleanPhone)
            .maybeSingle();

          if (raceCustomer) {
            customerId = raceCustomer.id;
            customerCode = raceCustomer.customer_code || null;
            isNewCustomer = false;
            await supabase
              .from("customers")
              .update(upsertCustomerDetails)
              .eq("id", customerId);

            if (!customerCode) {
              customerCode = await assignMissingCustomerCode(customerId);
            }
            break;
          }

          continue;
        }

        console.error("Customer creation error:", custErr);
        return apiError("خطأ في تسجيل الزبون", 500);
      }

      if (!customerId!) {
        return apiError("خطأ في تسجيل الزبون", 500);
      }
    }

    // === 2. Verify prices from DB ===
    let orderId = generateOrderId();
    const productIds = items.map((i: CartItem) => i.productId).filter(Boolean);
    let priceMap: Record<string, number> = {};
    if (productIds.length > 0) {
      const { data: dbProducts } = await supabase
        .from("products")
        .select("id, price")
        .in("id", productIds);
      if (dbProducts) {
        priceMap = Object.fromEntries(dbProducts.map((p: Pick<Product, "id" | "price">) => [p.id, Number(p.price)]));
      }
    }
    const verifiedItems: CartItem[] = items.map((i: CartItem) => {
      const dbPrice = i.productId ? priceMap[i.productId] : undefined;
      return { ...i, price: dbPrice ?? i.price };
    });
    const itemsTotal = verifiedItems.reduce((s: number, i: CartItem) => s + i.price * (i.quantity || 1), 0);

    let discount = 0;
    if (couponCode && typeof couponCode === "string") {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("active", true)
        .single();

      if (coupon) {
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at) >= new Date();
        const notExhausted = !coupon.max_uses || coupon.used_count < coupon.max_uses;
        const meetsMinOrder = itemsTotal >= (coupon.min_order || 0);

        if (notExpired && notExhausted && meetsMinOrder) {
          discount =
            coupon.type === "percent"
              ? Math.round(itemsTotal * (coupon.value / 100))
              : Math.min(coupon.value, itemsTotal);

          // Cap at max_discount if set (for percent-type coupons)
          if (coupon.max_discount && discount > coupon.max_discount) {
            discount = coupon.max_discount;
          }

          // Note: coupon usage is incremented via RPC below (step 4)
          // Do NOT increment inline here to avoid double-counting
        }
      }
    }
    const total = Math.max(0, itemsTotal - discount);

    // === 2b. Atomic order creation via RPC (single transaction) ===
    const orderItems = verifiedItems.map((i: CartItem) => ({
      product_id: i.productId || null,
      product_name: i.name,
      product_brand: i.brand,
      product_type: i.type,
      price: i.price,
      quantity: i.quantity || 1,
      color: i.color || null,
      storage: i.storage || null,
    }));

    let rpcResult: unknown = null;
    let rpcErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) orderId = generateOrderId();
      const res = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("create_order_atomic", {
        p_order_id: orderId,
        p_customer_id: customerId,
        p_source: source || "store",
        p_items_total: itemsTotal,
        p_discount_amount: discount,
        p_total: total,
        p_coupon_code: couponCode || "",
        p_payment_method: onlinePaymentEligible ? "credit" : "bank",
        p_payment_details: {
          ...(payment || {}),
          payment_status: onlinePaymentEligible ? "awaiting_redirect" : "pending",
        },
        p_shipping_city: customer.city,
        p_shipping_address: customer.address,
        p_customer_notes: customer.notes || "",
        p_items: orderItems,
      });
      rpcResult = res.data;
      rpcErr = res.error;
      if (!rpcErr || !rpcErr.message?.includes("duplicate key")) break;
    }

    if (rpcErr) {
      console.error("Order atomic creation error:", rpcErr);
      const msg = rpcErr.message || "";
      // Surface stock/coupon errors clearly to the user
      if (msg.includes("المخزون غير كافٍ")) return apiError(msg, 409);
      if (msg.includes("الكوبون غير صالح")) return apiError(msg, 409);
      if (msg.includes("المنتج غير موجود")) {
        return apiError(
          "منتج في السلة لم يعد متوفراً — أعد تحديث السلة وأزل العناصر القديمة",
          409,
        );
      }
      return apiError("خطأ في إنشاء الطلب", 500);
    }

    // === 7. WhatsApp Notifications (Season 4) ===
    try {
      const { notifyNewOrder } = await import("@/lib/bot/notifications");
      await notifyNewOrder(orderId, customer.name, customer.phone, total, source || "store");
    } catch (notifErr) {
      console.error("WhatsApp notification failed:", notifErr);
    }

    // === 7b. Admin Notifications (WhatsApp + email) ===
    try {
      const { notifyAdminNewOrder } = await import("@/lib/bot/admin-notify");
      await notifyAdminNewOrder({
        orderId,
        customerName: customer.name,
        customerPhone: customer.phone,
        total,
        source: source || "store",
        items: verifiedItems.map((i: CartItem) => ({
          name: i.name || i.productName || "منتج",
          qty: i.quantity || 1,
          price: Number(i.price || 0),
        })),
      });
    } catch (adminErr) {
      console.error("Admin new-order notification failed:", adminErr);
    }

    // === 8. Email Confirmation (enhanced templates) ===
    if (customer.email) {
      try {
        const { orderConfirmationEmail } = await import("@/lib/email-templates");
        const { getProvider } = await import("@/lib/integrations/hub");
        const emailProvider = await getProvider<EmailProvider>("email");
        if (emailProvider) {
          const tmpl = orderConfirmationEmail(
            orderId,
            customer.name,
            total,
            verifiedItems.map((i: CartItem) => ({ name: i.productName || i.name, qty: i.quantity || 1, price: i.price })),
            onlinePaymentEligible ? "credit" : "bank",
            customer.city,
            customer.address,
          );
          await emailProvider.send({
            to: customer.email,
            subject: tmpl.subject,
            html: tmpl.html,
          });
        }
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }
    }

    return apiSuccess({
      orderId,
      total,
      status: onlinePaymentEligible ? "pending_payment" : "new",
      // Only accessory-only orders get an online payment redirect.
      needsPayment: onlinePaymentEligible,
      customerCode: customerCode || undefined,
      isNewCustomer,
      message: !onlinePaymentEligible
        ? "تم استلام الطلب — الفريق سيتواصل معك"
        : "جاري تحويلك لصفحة الدفع الآمنة...",
    });

  } catch (err: unknown) {
    console.error("Order API error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
