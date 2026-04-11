
// =====================================================
// ClalMobile — POST /api/orders
// Creates order + customer in Supabase
// Triggers: audit log, customer stats (via DB trigger)
// Future: email notification, WhatsApp alert
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { generateOrderId, validatePhone, validateIsraeliID } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
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

export async function POST(req: NextRequest) {
  try {
    const body: OrderRequestBody = await req.json();
    const { customer, items, payment, couponCode, discountAmount: _discountAmount, source } = body;

    // === Validation ===
    if (!customer?.name || !customer?.phone || !customer?.city || !customer?.address) {
      return apiError("بيانات ناقصة", 400);
    }

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

    const hasDevice = items.some((i: CartItem) => i.type === "device");
    if (hasDevice && customer.idNumber && !validateIsraeliID(customer.idNumber)) {
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
      .single();

    let customerId: string;
    let assignedCode: string | null = null;
    let isNewCustomer = false;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      assignedCode = (existingCustomer as { customer_code?: string | null }).customer_code ?? null;

      // Update customer info
      await supabase
        .from("customers")
        .update({
          name: customer.name,
          email: customer.email || undefined,
          city: customer.city,
          address: customer.address,
          id_number: customer.idNumber || undefined,
        })
        .eq("id", customerId);

      // Trickle-in backfill for legacy customers without a code
      if (!assignedCode) {
        const { data: coded } = await supabase.rpc("assign_code_to_existing_customer", {
          p_customer_id: customerId,
        });
        if (coded) assignedCode = coded as string;
      }
    } else {
      isNewCustomer = true;
      const { data: newCustomer, error: custErr } = await supabase
        .from("customers")
        .insert({
          name: customer.name,
          phone: cleanPhone,
          email: customer.email || undefined,
          city: customer.city,
          address: customer.address,
          id_number: customer.idNumber || undefined,
          segment: "new",
          // customer_code NOT provided — DB trigger generates it
        } as Record<string, unknown>)
        .select("id, customer_code")
        .single();

      if (custErr || !newCustomer) {
        // 23505 on phone = race condition (someone else created it concurrently)
        if ((custErr as { code?: string } | null)?.code === "23505") {
          const { data: existsNow } = await supabase
            .from("customers")
            .select("id, customer_code")
            .eq("phone", cleanPhone)
            .single();
          if (existsNow) {
            customerId = existsNow.id;
            assignedCode = (existsNow as { customer_code?: string | null }).customer_code ?? null;
            isNewCustomer = false;
          } else {
            console.error("Customer creation race condition unresolved:", custErr);
            return apiError("خطأ في تسجيل الزبون", 500);
          }
        } else {
          console.error("Customer creation error:", custErr);
          return apiError("خطأ في تسجيل الزبون", 500);
        }
      } else {
        customerId = newCustomer.id;
        assignedCode = (newCustomer as { customer_code?: string | null }).customer_code ?? null;
      }
    }

    // === 2. Verify prices from DB ===
    const orderId = generateOrderId();
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
    const _onlyAccessories = !hasDevice && items.length > 0;

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

    const { data: rpcResult, error: rpcErr } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("create_order_atomic", {
      p_order_id: orderId,
      p_customer_id: customerId,
      p_source: source || "store",
      p_items_total: itemsTotal,
      p_discount_amount: discount,
      p_total: total,
      p_coupon_code: couponCode || "",
      p_payment_method: hasDevice ? "bank" : "credit",
      p_payment_details: {
        ...(payment || {}),
        payment_status: hasDevice ? "pending" : "awaiting_redirect",
      },
      p_shipping_city: customer.city,
      p_shipping_address: customer.address,
      p_customer_notes: customer.notes || "",
      p_items: orderItems,
    });

    if (rpcErr) {
      console.error("Order atomic creation error:", rpcErr);
      const msg = rpcErr.message || "";
      // Surface stock/coupon errors clearly to the user
      if (msg.includes("المخزون غير كافٍ")) return apiError(msg, 409);
      if (msg.includes("الكوبون غير صالح")) return apiError(msg, 409);
      return apiError("خطأ في إنشاء الطلب", 500);
    }

    // === 7. WhatsApp Notifications (Season 4) ===
    try {
      const { notifyNewOrder } = await import("@/lib/bot/notifications");
      await notifyNewOrder(
        orderId,
        customer.name,
        customer.phone,
        total,
        source || "store",
        isNewCustomer ? assignedCode : null,
      );
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
            hasDevice ? "bank" : "credit",
            customer.city,
            customer.address,
            isNewCustomer ? assignedCode : null,
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
      status: hasDevice ? "new" : "pending_payment",
      // Only accessories get Rivhit payment redirect
      needsPayment: !hasDevice,
      customerCode: assignedCode,
      isNewCustomer,
      message: hasDevice
        ? "تم استلام الطلب — الفريق سيتواصل معك"
        : "جاري تحويلك لصفحة الدفع الآمنة...",
    });

  } catch (err: unknown) {
    console.error("Order API error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
