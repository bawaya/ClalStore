
// =====================================================
// ClalMobile — Customer Orders API
// GET /api/customer/orders — fetch orders for authenticated customer
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { authenticateCustomer } from "@/lib/customer-auth";

export async function GET(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("غير مصرح", 401);
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("خطأ في السيرفر", 500);
    }

    // Fetch orders by customer_id
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch customer orders error:", error);
      return apiError("خطأ في جلب الطلبات", 500);
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

    return apiSuccess({ orders: result });
  } catch (err: unknown) {
    console.error("Customer orders error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
