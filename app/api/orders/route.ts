export const runtime = 'edge';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const hasDevice = items.some((i: any) => i.type === "device");
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
      .select("id")
      .eq("phone", cleanPhone)
      .single();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
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
    } else {
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
        } as any)
        .select("id")
        .single();

      if (custErr || !newCustomer) {
        console.error("Customer creation error:", custErr);
        return apiError("خطأ في تسجيل الزبون", 500);
      }
      customerId = newCustomer.id;
    }

    // === 2. Verify prices from DB ===
    const orderId = generateOrderId();
    const productIds = items.map((i: any) => i.productId).filter(Boolean);
    let priceMap: Record<string, number> = {};
    if (productIds.length > 0) {
      const { data: dbProducts } = await supabase
        .from("products")
        .select("id, price")
        .in("id", productIds);
      if (dbProducts) {
        priceMap = Object.fromEntries(dbProducts.map((p: any) => [p.id, Number(p.price)]));
      }
    }
    const verifiedItems = items.map((i: any) => {
      const dbPrice = i.productId && priceMap[i.productId];
      return { ...i, price: dbPrice ?? i.price };
    });
    const itemsTotal = verifiedItems.reduce((s: number, i: any) => s + i.price * (i.quantity || 1), 0);

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

    const { error: orderErr } = await supabase.from("orders").insert({
      id: orderId,
      customer_id: customerId,
      status: "new",
      source: source || "store",
      items_total: itemsTotal,
      discount_amount: discount,
      total: total,
      coupon_code: couponCode || undefined,
      payment_method: hasDevice ? "bank" : "credit",
      payment_details: {
        ...(payment || {}),
        payment_status: hasDevice ? "pending" : "awaiting_redirect",
      },
      shipping_city: customer.city,
      shipping_address: customer.address,
      customer_notes: customer.notes || undefined,
    } as any);

    if (orderErr) {
      console.error("Order creation error:", orderErr);
      return apiError("خطأ في إنشاء الطلب", 500);
    }

    // === 3. Create Order Items ===
    const orderItems = verifiedItems.map((i: any) => ({
      order_id: orderId,
      product_id: i.productId || null,
      product_name: i.name,
      product_brand: i.brand,
      product_type: i.type,
      price: i.price,
      quantity: i.quantity || 1,
      color: i.color || null,
      storage: i.storage || null,
    }));

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsErr) {
      console.error("Order items error:", itemsErr);
      // Cleanup: delete the order since items failed
      await supabase.from("orders").delete().eq("id", orderId);
      return apiError("خطأ في حفظ تفاصيل الطلب", 500);
    }

    // === 4. Update Coupon Usage ===
    if (couponCode) {
      const { error: couponErr } = await (supabase.rpc as any)("increment_coupon_usage", { coupon_code: couponCode.toUpperCase() });
      if (couponErr) {
        console.error("Coupon usage update failed:", couponErr);
      }
    }

    // === 5. Audit Log ===
    await supabase.from("audit_log").insert({
      user_name: "النظام",
      action: `طلب جديد ${orderId} — ₪${total} — ${customer.name}`,
      entity_type: "order",
      entity_id: orderId,
      details: { source, total, items_count: verifiedItems.length, has_device: hasDevice },
    });

    // === 6. Update Product Stock ===
    for (const item of verifiedItems) {
      if (item.productId) {
        const { error: stockErr } = await (supabase.rpc as any)("decrement_stock", {
          product_id: item.productId,
          qty: item.quantity || 1,
          variant_storage: item.storage || null,
        });
        if (stockErr) {
          console.error("Stock decrement failed:", stockErr);
        }
      }
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
        items: verifiedItems.map((i: any) => ({
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
        const emailProvider = await getProvider<any>("email");
        if (emailProvider) {
          const tmpl = orderConfirmationEmail(
            orderId,
            customer.name,
            total,
            verifiedItems.map((i: any) => ({ name: i.productName || i.name, qty: i.quantity || 1, price: i.price })),
            hasDevice ? "bank" : "credit",
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
      status: hasDevice ? "new" : "pending_payment",
      // Only accessories get Rivhit payment redirect
      needsPayment: !hasDevice,
      message: hasDevice
        ? "تم استلام الطلب — الفريق سيتواصل معك"
        : "جاري تحويلك لصفحة الدفع الآمنة...",
    });

  } catch (err: unknown) {
    console.error("Order API error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
