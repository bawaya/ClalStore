export const runtime = 'edge';

// =====================================================
// ClalMobile — POST /api/orders
// Creates order + customer in Supabase
// Triggers: audit log, customer stats (via DB trigger)
// Future: email notification, WhatsApp alert
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { generateOrderId, validatePhone, validateIsraeliID } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items, payment, couponCode, discountAmount, source } = body;

    // === Validation ===
    if (!customer?.name || !customer?.phone || !customer?.city || !customer?.address) {
      return NextResponse.json({ success: false, error: "بيانات ناقصة" }, { status: 400 });
    }

    if (!validatePhone(customer.phone)) {
      return NextResponse.json({ success: false, error: "رقم هاتف غير صالح" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: "السلة فارغة" }, { status: 400 });
    }

    const hasDevice = items.some((i: any) => i.type === "device");
    if (hasDevice && customer.idNumber && !validateIsraeliID(customer.idNumber)) {
      return NextResponse.json({ success: false, error: "رقم هوية غير صالح" }, { status: 400 });
    }

    const supabase = createAdminSupabase();

    if (!supabase) {
      console.error("Order API: Supabase admin client is null — check SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ success: false, error: "خطأ في إعدادات السيرفر" }, { status: 500 });
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
        return NextResponse.json({ success: false, error: "خطأ في تسجيل الزبون" }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // === 2. Create Order ===
    const orderId = generateOrderId();
    const itemsTotal = items.reduce((s: number, i: any) => s + i.price * (i.quantity || 1), 0);
    const discount = discountAmount || 0;
    const total = Math.max(0, itemsTotal - discount);
    const onlyAccessories = !hasDevice && items.length > 0;

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
      return NextResponse.json({ success: false, error: "خطأ في إنشاء الطلب" }, { status: 500 });
    }

    // === 3. Create Order Items ===
    const orderItems = items.map((i: any) => ({
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
      // Order exists, items failed — log but don't fail
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
      details: { source, total, items_count: items.length, has_device: hasDevice },
    });

    // === 6. Update Product Stock ===
    for (const item of items) {
      if (item.productId) {
        const { error: stockErr } = await (supabase.rpc as any)("decrement_stock", {
          product_id: item.productId,
          qty: item.quantity || 1,
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

    // === 7b. Admin Report Notification ===
    try {
      const { notifyAdminNewOrder } = await import("@/lib/bot/admin-notify");
      await notifyAdminNewOrder({
        orderId,
        customerName: customer.name,
        customerPhone: customer.phone,
        total,
        source: source || "store",
        items: items.map((i: any) => ({ name: i.name || i.productName, qty: i.quantity || 1, price: i.price })),
      });
    } catch (adminErr) {
      console.error("Admin notification failed:", adminErr);
    }

    // === 8. Email Confirmation (Season 6) ===
    if (customer.email) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
        if (appUrl) {
          await fetch(`${appUrl}/api/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "order_confirm",
              orderId,
              customerName: customer.name,
              customerEmail: customer.email,
              total,
              items: items.map((i: any) => ({ name: i.productName || i.name, qty: i.quantity || 1, price: i.price })),
            }),
          });
        }
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      total,
      status: hasDevice ? "new" : "pending_payment",
      // Only accessories get Rivhit payment redirect
      needsPayment: !hasDevice,
      message: hasDevice
        ? "تم استلام الطلب — الفريق سيتواصل معك"
        : "جاري تحويلك لصفحة الدفع الآمنة...",
    });

  } catch (err: any) {
    console.error("Order API error:", err);
    return NextResponse.json(
      { success: false, error: "خطأ في السيرفر" },
      { status: 500 }
    );
  }
}
