export const runtime = 'edge';

// =====================================================
// ClalMobile — Daily Report (Formatted HTML Page)
// GET /api/reports/daily?date=2025-01-15
// Shows: orders, revenue, contacts, bot stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const startOfDay = `${dateParam}T00:00:00.000Z`;
  const endOfDay = `${dateParam}T23:59:59.999Z`;

  const supabase = createAdminSupabase();
  if (!supabase) {
    return new NextResponse("Server Error", { status: 500 });
  }

  // === Fetch Data ===
  const [ordersRes, customersRes, conversationsRes, handoffsRes] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false }),
    supabase.from("customers").select("*").gte("created_at", startOfDay).lte("created_at", endOfDay),
    supabase.from("bot_conversations").select("*").gte("created_at", startOfDay).lte("created_at", endOfDay),
    supabase.from("bot_handoffs").select("*").gte("created_at", startOfDay).lte("created_at", endOfDay),
  ]);

  const orders = ordersRes.data || [];
  const newCustomers = customersRes.data || [];
  const conversations = conversationsRes.data || [];
  const handoffs = handoffsRes.data || [];

  // === Calculate Stats ===
  const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const deviceOrders = orders.filter((o: any) => (o.order_items || []).some((i: any) => i.product_type === "device"));
  const accessoryOrders = orders.filter((o: any) => (o.order_items || []).every((i: any) => i.product_type !== "device"));
  const statusCounts: Record<string, number> = {};
  orders.forEach((o: any) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const sourceCounts: Record<string, number> = {};
  orders.forEach((o: any) => { sourceCounts[o.source || "store"] = (sourceCounts[o.source || "store"] || 0) + 1; });

  const botMessages = conversations.reduce((s: number, c: any) => s + Number(c.message_count || 0), 0);
  const whatsappConvos = conversations.filter((c: any) => c.channel === "whatsapp").length;
  const webchatConvos = conversations.filter((c: any) => c.channel === "webchat").length;

  // === Build HTML ===
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التقرير اليومي — ${dateParam}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #0a0a0f; color: #e4e4e7; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
    .header { text-align: center; margin-bottom: 32px; padding: 24px; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 16px; border: 1px solid #333; }
    .header h1 { font-size: 28px; color: #e50914; margin-bottom: 8px; }
    .header .date { font-size: 18px; color: #a1a1aa; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 16px; text-align: center; }
    .stat-card .value { font-size: 32px; font-weight: 800; color: #e50914; }
    .stat-card .label { font-size: 13px; color: #a1a1aa; margin-top: 4px; }
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
    .empty { text-align: center; color: #71717a; padding: 24px; }
    .footer { text-align: center; margin-top: 32px; color: #52525b; font-size: 12px; }
    .footer a { color: #e50914; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 التقرير اليومي</h1>
      <div class="date">${dateParam}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${orders.length}</div>
        <div class="label">📦 طلبات</div>
      </div>
      <div class="stat-card">
        <div class="value">₪${totalRevenue.toLocaleString()}</div>
        <div class="label">💰 إجمالي المبيعات</div>
      </div>
      <div class="stat-card">
        <div class="value">₪${avgOrderValue.toLocaleString()}</div>
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
      <div class="stat-card">
        <div class="value">${handoffs.length}</div>
        <div class="label">🔄 تحويل لموظف</div>
      </div>
      <div class="stat-card">
        <div class="value">${deviceOrders.length}/${accessoryOrders.length}</div>
        <div class="label">📱 أجهزة / إكسسوارات</div>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="section">
      <h2>📦 الطلبات (${orders.length})</h2>
      ${orders.length === 0 ? '<div class="empty">لا توجد طلبات اليوم</div>' : `
      <div style="overflow-x:auto">
      <table>
        <thead><tr><th>رقم الطلب</th><th>الزبون</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th>المصدر</th><th>الوقت</th></tr></thead>
        <tbody>
          ${orders.map((o: any) => {
            const items = (o.order_items || []).map((i: any) => i.product_name).join("، ");
            const statusMap: Record<string, string> = { new: "جديد", approved: "موافق", processing: "تجهيز", shipped: "شحن", delivered: "تسليم", cancelled: "ملغي" };
            const badgeClass = `badge-${o.status}`;
            return `<tr>
              <td><strong>${o.id}</strong></td>
              <td>${(o as any).customer_id?.slice(0, 8) || "—"}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items || "—"}</td>
              <td><strong>₪${Number(o.total).toLocaleString()}</strong></td>
              <td><span class="badge ${badgeClass}">${statusMap[o.status] || o.status}</span></td>
              <td>${o.source || "store"}</td>
              <td>${new Date(o.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</td>
            </tr>`;
          }).join("")}
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

    <!-- Bot Stats -->
    <div class="section">
      <h2>🤖 إحصائيات البوت</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${whatsappConvos}</div>
          <div class="label">واتساب</div>
        </div>
        <div class="stat-card">
          <div class="value">${webchatConvos}</div>
          <div class="label">شات الموقع</div>
        </div>
        <div class="stat-card">
          <div class="value">${handoffs.length}</div>
          <div class="label">تحويل لموظف</div>
        </div>
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

    <div class="footer">
      <p>كلال موبايل — نظام التقارير الآلي</p>
      <p><a href="https://clalmobile.com/crm">🔗 لوحة التحكم CRM</a> | <a href="https://clalmobile.com/admin">⚙️ الإدارة</a></p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
