export const runtime = 'edge';

// =====================================================
// ClalMobile — Customer Orders API
// GET /api/customer/orders — fetch orders for authenticated customer
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

async function authenticateCustomer(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token || token.length < 32) return null;

  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, email, city, address")
    .eq("auth_token", token)
    .single();

  return customer;
}

export async function GET(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
    }

    // Fetch orders by customer_id
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch customer orders error:", error);
      return NextResponse.json({ success: false, error: "خطأ في جلب الطلبات" }, { status: 500 });
    }

    // Fetch order items for all orders
    const orderIds = (orders || []).map((o: any) => o.id);
    let items: any[] = [];

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      items = orderItems || [];
    }

    // Group items by order_id
    const itemsByOrder: Record<string, any[]> = {};
    for (const item of items) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    // Combine
    const result = (orders || []).map((order: any) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      items_total: order.items_total,
      discount_amount: order.discount_amount,
      coupon_code: order.coupon_code,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      shipping_city: order.shipping_city,
      shipping_address: order.shipping_address,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: itemsByOrder[order.id] || [],
    }));

    return NextResponse.json({ success: true, orders: result });
  } catch (err: any) {
    console.error("Customer orders error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
