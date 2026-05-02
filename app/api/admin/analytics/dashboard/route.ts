
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function startOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString();
}
function endOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59).toISOString();
}
function weekKey(dateStr: string) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("DB error", 500);
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const prevMonthStart = startOfPrevMonth(now);
    const prevMonthEnd = endOfPrevMonth(now);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

    const [
      ordersThisMonth,
      ordersPrevMonth,
      ordersLast30,
      orderItemsRes,
      customersLast90,
      abandonedRes,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total, status, source, created_at")
        .is("deleted_at", null)
        .gte("created_at", thisMonthStart)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("id, total, status, source, created_at")
        .is("deleted_at", null)
        .gte("created_at", prevMonthStart)
        .lt("created_at", prevMonthEnd)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("id, total, status, source, created_at")
        .is("deleted_at", null)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true }),
      supabase
        .from("order_items")
        .select("product_name, quantity, order_id")
        .limit(2000),
      supabase
        .from("customers")
        .select("id, created_at")
        .gte("created_at", ninetyDaysAgo)
        .order("created_at", { ascending: true }),
      supabase
        .from("abandoned_carts")
        .select("id, total, recovered, created_at")
        .gte("created_at", thisMonthStart),
    ]);

    const thisOrders = ordersThisMonth.data || [];
    const prevOrders = ordersPrevMonth.data || [];
    const last30 = ordersLast30.data || [];
    const allItems = orderItemsRes.data || [];
    const recentCustomers = customersLast90.data || [];
    const carts = abandonedRes.data || [];

    // ---- Daily revenue for last 30 days ----
    const dailyMap: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { revenue: 0, orders: 0 };
    }
    for (const o of last30) {
      const day = new Date(o.created_at).toISOString().split("T")[0];
      if (dailyMap[day]) {
        dailyMap[day].revenue += Number(o.total) || 0;
        dailyMap[day].orders += 1;
      }
    }
    const dailyRevenue = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        label: date.slice(5),
        value: Math.round(d.revenue),
      }));

    // ---- Top products ----
    const productSales: Record<string, number> = {};
    for (const item of allItems) {
      const name = item.product_name || "غير معروف";
      productSales[name] = (productSales[name] || 0) + (item.quantity || 1);
    }
    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));

    // ---- Order status distribution ----
    const statusMap: Record<string, number> = {};
    for (const o of thisOrders) {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    }

    // ---- Sales by source ----
    const sourceMap: Record<string, number> = {};
    for (const o of thisOrders) {
      const src = o.source || "direct";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    }

    // ---- Customer growth (weekly for last 90 days) ----
    const weekMap: Record<string, number> = {};
    for (const c of recentCustomers) {
      const wk = weekKey(c.created_at);
      weekMap[wk] = (weekMap[wk] || 0) + 1;
    }
    const customerGrowth = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value }));

    // ---- Month-over-month metrics ----
    const thisRevenue = thisOrders.reduce((s: number, o: { total: number }) => s + (Number(o.total) || 0), 0);
    const prevRevenue = prevOrders.reduce((s: number, o: { total: number }) => s + (Number(o.total) || 0), 0);
    const thisOrderCount = thisOrders.length;
    const prevOrderCount = prevOrders.length;
    const avgOrderValue = thisOrderCount > 0 ? Math.round(thisRevenue / thisOrderCount) : 0;

    const thisMonthCustomers = recentCustomers.filter(
      (c: { created_at: string }) => new Date(c.created_at) >= new Date(thisMonthStart)
    ).length;
    const prevMonthCustomers = recentCustomers.filter((c: { created_at: string }) => {
      const d = new Date(c.created_at);
      return d >= new Date(prevMonthStart) && d < new Date(thisMonthStart);
    }).length;

    // ---- Cart abandonment ----
    const totalCarts = carts.length;
    const recoveredCarts = carts.filter((c: { recovered: boolean }) => c.recovered).length;
    const abandonmentRate =
      totalCarts + thisOrderCount > 0
        ? Math.round((totalCarts / (totalCarts + thisOrderCount)) * 100)
        : 0;

    // ---- Conversion rate (approximated: orders / (orders + abandoned)) ----
    const conversionRate =
      totalCarts + thisOrderCount > 0
        ? Math.round((thisOrderCount / (totalCarts + thisOrderCount)) * 100)
        : 0;

    const pctChange = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

    return apiSuccess({
        metrics: {
          totalRevenue: Math.round(thisRevenue),
          prevRevenue: Math.round(prevRevenue),
          revenueChange: pctChange(thisRevenue, prevRevenue),
          totalOrders: thisOrderCount,
          prevOrders: prevOrderCount,
          ordersChange: pctChange(thisOrderCount, prevOrderCount),
          avgOrderValue,
          newCustomers: thisMonthCustomers,
          prevCustomers: prevMonthCustomers,
          customersChange: pctChange(thisMonthCustomers, prevMonthCustomers),
          conversionRate,
          abandonmentRate,
          recoveredCarts,
          totalCarts,
        },
        dailyRevenue,
        topProducts,
        statusDistribution: statusMap,
        sourceDistribution: sourceMap,
        customerGrowth,
    });
  } catch (err: unknown) {
    console.error("Analytics dashboard API error:", err);
    return apiError("Internal server error", 500);
  }
}
