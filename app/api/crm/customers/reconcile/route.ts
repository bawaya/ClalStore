import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

// 5.6.3: Reconcile customer stats (total_orders, total_spent, avg_order_value, last_order_at)
// Recalculates KPIs from orders table for all customers or a specific one
export const POST = withPermission(
  "customers",
  "edit",
  async (req: NextRequest, db: SupabaseClient) => {
    try {
      const body = await req.json().catch(() => ({}));
      const customerId = body.customer_id;

      let query = db
        .from("customers")
        .select("id");

      if (customerId) {
        query = query.eq("id", customerId);
      }

      const { data: customers, error: custErr } = await query;
      if (custErr) {
        console.error("Reconcile: failed to fetch customers:", custErr);
        return apiError("فشل في جلب العملاء", 500);
      }

      let updated = 0;
      let errors = 0;

      // Batch: fetch all orders for target customers in one query
      const custIds = (customers || []).map((c: { id: string }) => c.id);
      let ordersQuery = db
        .from("orders")
        .select("customer_id, total, status, created_at")
        .is("deleted_at", null);
      if (customerId) {
        ordersQuery = ordersQuery.eq("customer_id", customerId);
      } else {
        ordersQuery = ordersQuery.in("customer_id", custIds);
      }
      const { data: allOrders } = await ordersQuery;

      // Group orders by customer_id
      const ordersByCustomer = new Map<string, { total: number; status: string; created_at: string }[]>();
      for (const o of allOrders || []) {
        const list = ordersByCustomer.get(o.customer_id) || [];
        list.push(o);
        ordersByCustomer.set(o.customer_id, list);
      }

      for (const cust of customers || []) {
        const rows = ordersByCustomer.get(cust.id) || [];
        const nonRejected = rows.filter((r) => r.status !== "rejected");
        const billable = rows.filter(
          (r) => !["rejected", "new"].includes(r.status),
        );
        const totalSpent = billable.reduce(
          (sum: number, r) => sum + Number(r.total || 0),
          0,
        );
        const avg = billable.length > 0 ? totalSpent / billable.length : 0;
        const last =
          rows.length > 0
            ? rows
                .map((r) => r.created_at)
                .sort()
                .at(-1) || null
            : null;

        const { error: upErr } = await db
          .from("customers")
          .update({
            total_orders: nonRejected.length,
            total_spent: totalSpent,
            avg_order_value: avg,
            last_order_at: last,
          })
          .eq("id", cust.id);

        if (upErr) {
          console.error("Reconcile: failed to update customer:", cust.id, upErr);
          errors++;
        } else {
          updated++;
        }
      }

      return apiSuccess({ updated, errors, total: (customers || []).length });
    } catch (err) {
      console.error("Customer stats reconciliation error:", err);
      return apiError("خطأ في مصالحة الإحصائيات", 500);
    }
  },
);
