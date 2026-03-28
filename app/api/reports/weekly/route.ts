export const runtime = 'edge';

// =====================================================
// ClalMobile — Weekly Report (Formatted HTML Page)
// GET /api/reports/weekly?date=2025-01-15
// Shows: week overview, orders, revenue trends, top products
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  // Auth: allow CRON_SECRET or authenticated admin
  const secret = process.env.CRON_SECRET;
  const authHeader = req.nextUrl.searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const isCron = secret && authHeader === secret;
  if (!isCron) {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
  }

  const dateParam = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const endDate = new Date(dateParam + "T23:59:59.999Z");
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  const prevWeekEnd = new Date(startDate);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const supabase = createAdminSupabase();
  if (!supabase) {
    return new NextResponse("Server Error", { status: 500 });
  }

  // === Fetch Data ===
  const [ordersRes, prevOrdersRes, customersRes, conversationsRes, handoffsRes] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }),
    supabase.from("orders").select("id, total, status").gte("created_at", prevWeekStart.toISOString()).lte("created_at", prevWeekEnd.toISOString()),
    supabase.from("customers").select("*").gte("created_at", startISO).lte("created_at", endISO),
    supabase.from("bot_conversations").select("*").gte("created_at", startISO).lte("created_at", endISO),
    supabase.from("bot_handoffs").select("*").gte("created_at", startISO).lte("created_at", endISO),
  ]);

  const orders = ordersRes.data || [];
  const prevOrders = prevOrdersRes.data || [];
  const newCustomers = customersRes.data || [];
  const conversations = conversationsRes.data || [];
  const handoffs = handoffsRes.data || [];

  // === Stats ===
  const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const prevRevenue = prevOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
  const ordersChange = prevOrders.length > 0 ? Math.round(((orders.length - prevOrders.length) / prevOrders.length) * 100) : 0;
  const avgOrder = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

  // Top products
  const productCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach((o: any) => {
    (o.order_items || []).forEach((i: any) => {
      const key = i.product_name || "Unknown";
      if (!productCounts[key]) productCounts[key] = { name: key, count: 0, revenue: 0 };
      productCounts[key].count += i.quantity || 1;
      productCounts[key].revenue += Number(i.price) * (i.quantity || 1);
    });
  });
  const topProducts = Object.values(productCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Daily breakdown
  const dailyStats: Record<string, { orders: number; revenue: number }> = {};
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  for (let d = 0; d < 7; d++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + d);
    const dayKey = day.toISOString().split("T")[0];
    dailyStats[dayKey] = { orders: 0, revenue: 0 };
  }
  orders.forEach((o: any) => {
    const dayKey = new Date(o.created_at).toISOString().split("T")[0];
    if (dailyStats[dayKey]) {
      dailyStats[dayKey].orders++;
      dailyStats[dayKey].revenue += Number(o.total || 0);
    }
  });

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  orders.forEach((o: any) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  const sourceCounts: Record<string, number> = {};
  orders.forEach((o: any) => { sourceCounts[o.source || "store"] = (sourceCounts[o.source || "store"] || 0) + 1; });

  const botMessages = conversations.reduce((s: number, c: any) => s + Number(c.message_count || 0), 0);
  const whatsappConvos = conversations.filter((c: any) => c.channel === "whatsapp").length;
  const webchatConvos = conversations.filter((c: any) => c.channel === "webchat").length;

  const startLabel = startDate.toISOString().split("T")[0];
  const endLabel = dateParam;

  // === Build HTML ===
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التقرير الأسبوعي — ${startLabel} → ${endLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #0a0a0f; color: #e4e4e7; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
    .header { text-align: center; margin-bottom: 32px; padding: 24px; background: linear-gradient(135deg, #1a1a2e, #0f3460); border-radius: 16px; border: 1px solid #333; }
    .header h1 { font-size: 28px; color: #e50914; margin-bottom: 4px; }
    .header .date { font-size: 16px; color: #a1a1aa; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 16px; text-align: center; }
    .stat-card .value { font-size: 28px; font-weight: 800; color: #e50914; }
    .stat-card .label { font-size: 12px; color: #a1a1aa; margin-top: 4px; }
    .stat-card .change { font-size: 11px; margin-top: 2px; }
    .change-up { color: #4ade80; }
    .change-down { color: #f87171; }
    .section { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .section h2 { font-size: 18px; color: #fff; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #333; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #16213e; color: #a1a1aa; padding: 10px 8px; text-align: right; font-weight: 600; }
    td { padding: 10px 8px; border-bottom: 1px solid #222; }
    tr:hover td { background: rgba(229, 9, 20, 0.05); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; }
    .badge-new { background: #1e3a5f; color: #60a5fa; }
    .badge-approved { background: #14532d; color: #4ade80; }
    .badge-processing { background: #713f12; color: #fbbf24; }
    .badge-shipped { background: #3b0764; color: #c084fc; }
    .badge-delivered { background: #052e16; color: #22c55e; }
    .badge-cancelled { background: #450a0a; color: #f87171; }
    .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding: 12px 0; }
    .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
    .bar { background: linear-gradient(to top, #e50914, #ff4757); border-radius: 4px 4px 0 0; min-height: 4px; width: 100%; transition: height 0.3s; }
    .bar-label { font-size: 10px; color: #a1a1aa; margin-top: 4px; }
    .bar-value { font-size: 11px; color: #fff; font-weight: 600; margin-bottom: 4px; }
    .empty { text-align: center; color: #71717a; padding: 24px; }
    .footer { text-align: center; margin-top: 32px; color: #52525b; font-size: 12px; }
    .footer a { color: #e50914; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 التقرير الأسبوعي</h1>
      <div class="date">${startLabel} → ${endLabel}</div>
    </div>

    <!-- Key Metrics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${orders.length}</div>
        <div class="label">📦 إجمالي الطلبات</div>
        <div class="change ${ordersChange >= 0 ? "change-up" : "change-down"}">${ordersChange >= 0 ? "↑" : "↓"} ${Math.abs(ordersChange)}% عن الأسبوع السابق</div>
      </div>
      <div class="stat-card">
        <div class="value">₪${totalRevenue.toLocaleString()}</div>
        <div class="label">💰 إجمالي الإيرادات</div>
        <div class="change ${revenueChange >= 0 ? "change-up" : "change-down"}">${revenueChange >= 0 ? "↑" : "↓"} ${Math.abs(revenueChange)}% عن الأسبوع السابق</div>
      </div>
      <div class="stat-card">
        <div class="value">₪${avgOrder.toLocaleString()}</div>
        <div class="label">📊 متوسط الطلب</div>
      </div>
      <div class="stat-card">
        <div class="value">${newCustomers.length}</div>
        <div class="label">👤 زبائن جدد</div>
      </div>
      <div class="stat-card">
        <div class="value">${conversations.length}</div>
        <div class="label">💬 محادثات البوت</div>
      </div>
      <div class="stat-card">
        <div class="value">${botMessages}</div>
        <div class="label">📨 رسائل</div>
      </div>
    </div>

    <!-- Daily Chart -->
    <div class="section">
      <h2>📅 التوزيع اليومي</h2>
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>اليوم</th><th>التاريخ</th><th>الطلبات</th><th>الإيرادات</th></tr></thead>
        <tbody>
          ${Object.entries(dailyStats).map(([dayKey, stats]) => {
            const d = new Date(dayKey + "T12:00:00Z");
            const dayName = dayNames[d.getUTCDay()];
            return `<tr>
              <td><strong>${dayName}</strong></td>
              <td>${dayKey}</td>
              <td>${stats.orders}</td>
              <td><strong>₪${stats.revenue.toLocaleString()}</strong></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      </div>
    </div>

    <!-- Top Products -->
    <div class="section">
      <h2>🏆 أفضل المنتجات مبيعاً</h2>
      ${topProducts.length === 0 ? '<div class="empty">لا توجد بيانات</div>' : `
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيرادات</th></tr></thead>
        <tbody>
          ${topProducts.map((p, i) => `<tr>
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.count}</td>
            <td><strong>₪${p.revenue.toLocaleString()}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>
      </div>
      `}
    </div>

    <!-- Source Breakdown -->
    <div class="section">
      <h2>📡 مصادر الطلبات</h2>
      <div class="stats-grid">
        ${Object.entries(sourceCounts).map(([src, count]) => `
          <div class="stat-card">
            <div class="value">${count}</div>
            <div class="label">${src}</div>
          </div>
        `).join("")}
        ${Object.keys(sourceCounts).length === 0 ? '<div class="empty">لا توجد بيانات</div>' : ""}
      </div>
    </div>

    <!-- Status Breakdown -->
    <div class="section">
      <h2>📋 حالات الطلبات</h2>
      <div class="stats-grid">
        ${Object.entries(statusCounts).map(([status, count]) => {
          const labels: Record<string, string> = { new: "جديد", approved: "موافق", processing: "تجهيز", shipped: "شحن", delivered: "تسليم", cancelled: "ملغي", rejected: "مرفوض" };
          return `<div class="stat-card">
            <div class="value">${count}</div>
            <div class="label">${labels[status] || status}</div>
          </div>`;
        }).join("")}
        ${Object.keys(statusCounts).length === 0 ? '<div class="empty">لا توجد طلبات</div>' : ""}
      </div>
    </div>

    <!-- Bot Performance -->
    <div class="section">
      <h2>🤖 أداء البوت</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${whatsappConvos}</div>
          <div class="label">محادثات واتساب</div>
        </div>
        <div class="stat-card">
          <div class="value">${webchatConvos}</div>
          <div class="label">محادثات شات الموقع</div>
        </div>
        <div class="stat-card">
          <div class="value">${handoffs.length}</div>
          <div class="label">تحويلات لموظف</div>
        </div>
        <div class="stat-card">
          <div class="value">${conversations.length > 0 ? Math.round((handoffs.length / conversations.length) * 100) : 0}%</div>
          <div class="label">نسبة التحويل</div>
        </div>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="section">
      <h2>📦 جميع الطلبات (${orders.length})</h2>
      ${orders.length === 0 ? '<div class="empty">لا توجد طلبات هذا الأسبوع</div>' : `
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>رقم الطلب</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th>المصدر</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${orders.map((o: any) => {
            const items = (o.order_items || []).map((i: any) => i.product_name).join("، ");
            const labels: Record<string, string> = { new: "جديد", approved: "موافق", processing: "تجهيز", shipped: "شحن", delivered: "تسليم", cancelled: "ملغي" };
            const badgeClass = "badge-" + o.status;
            return `<tr>
              <td><strong>${o.id}</strong></td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items || "—"}</td>
              <td><strong>₪${Number(o.total).toLocaleString()}</strong></td>
              <td><span class="badge ${badgeClass}">${labels[o.status] || o.status}</span></td>
              <td>${o.source || "store"}</td>
              <td>${new Date(o.created_at).toLocaleDateString("ar-EG")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      </div>
      `}
    </div>

    <div class="footer">
      <p>كلال موبايل — نظام التقارير الآلي</p>
      <p><a href="https://clalmobile.com/crm">🔗 لوحة التحكم CRM</a> | <a href="https://clalmobile.com/admin">⚙️ الإدارة</a> | <a href="https://clalmobile.com/api/reports/daily?date=${dateParam}">📊 التقرير اليومي</a></p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
