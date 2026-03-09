export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "daily";
  const dateParam = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const supabase = createAdminSupabase();
  if (!supabase) {
    return new NextResponse(errorHtml("خطأ في الاتصال بقاعدة البيانات"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    if (type === "weekly") {
      return await generateWeeklyReport(supabase, dateParam);
    }
    return await generateDailyReport(supabase, dateParam);
  } catch (err: any) {
    console.error("[CRM Reports]", err);
    return new NextResponse(errorHtml("فشل في تحميل التقرير"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function errorHtml(msg: string) {
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:sans-serif;background:#0a0a0f;color:#f87171;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style></head><body><div style="text-align:center"><div style="font-size:48px;margin-bottom:16px">⚠️</div><p style="font-size:18px">${msg}</p></div></body></html>`;
}

async function generateDailyReport(supabase: any, dateParam: string) {
  const startOfDay = `${dateParam}T00:00:00.000Z`;
  const endOfDay = `${dateParam}T23:59:59.999Z`;

  const [ordersRes, customersRes, conversationsRes, handoffsRes] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false }),
    supabase.from("customers").select("id").gte("created_at", startOfDay).lte("created_at", endOfDay),
    supabase.from("bot_conversations").select("id, channel, message_count").gte("created_at", startOfDay).lte("created_at", endOfDay),
    supabase.from("bot_handoffs").select("id").gte("created_at", startOfDay).lte("created_at", endOfDay),
  ]);

  const orders = ordersRes.data || [];
  const newCustomers = customersRes.data || [];
  const conversations = conversationsRes.data || [];
  const handoffs = handoffsRes.data || [];

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

  const statusLabels: Record<string, string> = { new: "جديد", approved: "موافق", processing: "تجهيز", shipped: "شحن", delivered: "تسليم", cancelled: "ملغي", rejected: "مرفوض" };

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التقرير اليومي — ${dateParam}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#09090b;color:#e4e4e7;line-height:1.6}
    .container{max-width:800px;margin:0 auto;padding:24px 16px}
    .header{text-align:center;margin-bottom:28px;padding:24px;background:linear-gradient(135deg,#1a1025,#150a20);border-radius:16px;border:1px solid rgba(124,58,237,0.2)}
    .header h1{font-size:26px;color:#c4b5fd;margin-bottom:6px}
    .header .date{font-size:16px;color:#a1a1aa}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px}
    .stat-card{background:#13111a;border:1px solid rgba(124,58,237,0.12);border-radius:12px;padding:14px;text-align:center}
    .stat-card .value{font-size:28px;font-weight:800;background:linear-gradient(135deg,#7c3aed,#c41040);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .stat-card .label{font-size:12px;color:#a1a1aa;margin-top:4px}
    .section{background:#13111a;border:1px solid rgba(124,58,237,0.12);border-radius:12px;padding:18px;margin-bottom:14px}
    .section h2{font-size:16px;color:#e4e4e7;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(124,58,237,0.1)}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#1a1025;color:#a78bfa;padding:10px 8px;text-align:right;font-weight:600}
    td{padding:10px 8px;border-bottom:1px solid #1f1f2e}
    tr:hover td{background:rgba(124,58,237,0.04)}
    .badge{display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700}
    .badge-new{background:#1e3a5f;color:#60a5fa}.badge-approved{background:#14532d;color:#4ade80}
    .badge-processing{background:#713f12;color:#fbbf24}.badge-shipped{background:#3b0764;color:#c084fc}
    .badge-delivered{background:#052e16;color:#22c55e}.badge-cancelled,.badge-rejected{background:#450a0a;color:#f87171}
    .empty{text-align:center;color:#52525b;padding:24px}
    .footer{text-align:center;margin-top:28px;color:#52525b;font-size:11px}
    .footer a{color:#a78bfa;text-decoration:none}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 التقرير اليومي</h1>
      <div class="date">${dateParam}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="value">${orders.length}</div><div class="label">📦 طلبات</div></div>
      <div class="stat-card"><div class="value">₪${totalRevenue.toLocaleString()}</div><div class="label">💰 المبيعات</div></div>
      <div class="stat-card"><div class="value">₪${avgOrderValue.toLocaleString()}</div><div class="label">📊 متوسط الطلب</div></div>
      <div class="stat-card"><div class="value">${newCustomers.length}</div><div class="label">👤 زبائن جدد</div></div>
      <div class="stat-card"><div class="value">${conversations.length}</div><div class="label">💬 محادثات</div></div>
      <div class="stat-card"><div class="value">${botMessages}</div><div class="label">📨 رسائل</div></div>
      <div class="stat-card"><div class="value">${handoffs.length}</div><div class="label">🔄 تحويل لموظف</div></div>
      <div class="stat-card"><div class="value">${deviceOrders.length}/${accessoryOrders.length}</div><div class="label">📱/🎧</div></div>
    </div>
    <div class="section">
      <h2>📦 الطلبات (${orders.length})</h2>
      ${orders.length === 0 ? '<div class="empty">لا توجد طلبات في هذا اليوم</div>' : `
      <div style="overflow-x:auto"><table>
        <thead><tr><th>الرقم</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th>المصدر</th><th>الوقت</th></tr></thead>
        <tbody>${orders.map((o: any) => {
          const items = (o.order_items || []).map((i: any) => i.product_name).join("، ");
          return `<tr>
            <td><strong>${o.id}</strong></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items || "—"}</td>
            <td><strong>₪${Number(o.total).toLocaleString()}</strong></td>
            <td><span class="badge badge-${o.status}">${statusLabels[o.status] || o.status}</span></td>
            <td>${o.source || "store"}</td>
            <td>${new Date(o.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>`}
    </div>
    <div class="section">
      <h2>📡 المصادر</h2>
      <div class="stats-grid">
        ${Object.entries(sourceCounts).map(([src, count]) => `<div class="stat-card"><div class="value">${count}</div><div class="label">${src}</div></div>`).join("")}
        ${Object.keys(sourceCounts).length === 0 ? '<div class="empty">لا توجد بيانات</div>' : ""}
      </div>
    </div>
    <div class="section">
      <h2>🤖 البوت</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="value">${whatsappConvos}</div><div class="label">واتساب</div></div>
        <div class="stat-card"><div class="value">${webchatConvos}</div><div class="label">شات الموقع</div></div>
        <div class="stat-card"><div class="value">${handoffs.length}</div><div class="label">تحويل لموظف</div></div>
      </div>
    </div>
    <div class="section">
      <h2>📋 حالات الطلبات</h2>
      <div class="stats-grid">
        ${Object.entries(statusCounts).map(([status, count]) => `<div class="stat-card"><div class="value">${count}</div><div class="label">${statusLabels[status] || status}</div></div>`).join("")}
        ${Object.keys(statusCounts).length === 0 ? '<div class="empty">لا توجد طلبات</div>' : ""}
      </div>
    </div>
    <div class="footer"><p>ClalMobile — نظام التقارير</p><p><a href="https://clalmobile.com/crm">🔗 CRM</a> | <a href="https://clalmobile.com/admin">⚙️ الإدارة</a></p></div>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function generateWeeklyReport(supabase: any, dateParam: string) {
  const endDate = new Date(dateParam);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const start = startDate.toISOString().split("T")[0] + "T00:00:00.000Z";
  const end = dateParam + "T23:59:59.999Z";

  const [ordersRes, customersRes, conversationsRes] = await Promise.all([
    supabase.from("orders").select("id, total, status, source, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("customers").select("id").gte("created_at", start).lte("created_at", end),
    supabase.from("bot_conversations").select("id, channel, message_count").gte("created_at", start).lte("created_at", end),
  ]);

  const orders = ordersRes.data || [];
  const newCustomers = customersRes.data || [];
  const conversations = conversationsRes.data || [];
  const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const avgOrder = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

  const dailyBreakdown: Record<string, { count: number; revenue: number }> = {};
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyBreakdown[key] = { count: 0, revenue: 0 };
  }
  orders.forEach((o: any) => {
    const day = o.created_at?.split("T")[0];
    if (day && dailyBreakdown[day]) {
      dailyBreakdown[day].count++;
      dailyBreakdown[day].revenue += Number(o.total || 0);
    }
  });

  const startLabel = startDate.toISOString().split("T")[0];

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التقرير الأسبوعي — ${startLabel} → ${dateParam}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#09090b;color:#e4e4e7;line-height:1.6}
    .container{max-width:800px;margin:0 auto;padding:24px 16px}
    .header{text-align:center;margin-bottom:28px;padding:24px;background:linear-gradient(135deg,#1a1025,#150a20);border-radius:16px;border:1px solid rgba(124,58,237,0.2)}
    .header h1{font-size:26px;color:#c4b5fd;margin-bottom:6px}
    .header .date{font-size:14px;color:#a1a1aa}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px}
    .stat-card{background:#13111a;border:1px solid rgba(124,58,237,0.12);border-radius:12px;padding:14px;text-align:center}
    .stat-card .value{font-size:28px;font-weight:800;background:linear-gradient(135deg,#7c3aed,#c41040);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .stat-card .label{font-size:12px;color:#a1a1aa;margin-top:4px}
    .section{background:#13111a;border:1px solid rgba(124,58,237,0.12);border-radius:12px;padding:18px;margin-bottom:14px}
    .section h2{font-size:16px;color:#e4e4e7;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(124,58,237,0.1)}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#1a1025;color:#a78bfa;padding:10px 8px;text-align:right;font-weight:600}
    td{padding:10px 8px;border-bottom:1px solid #1f1f2e}
    .empty{text-align:center;color:#52525b;padding:24px}
    .footer{text-align:center;margin-top:28px;color:#52525b;font-size:11px}
    .footer a{color:#a78bfa;text-decoration:none}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 التقرير الأسبوعي</h1>
      <div class="date">${startLabel} → ${dateParam}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="value">${orders.length}</div><div class="label">📦 طلبات</div></div>
      <div class="stat-card"><div class="value">₪${totalRevenue.toLocaleString()}</div><div class="label">💰 المبيعات</div></div>
      <div class="stat-card"><div class="value">₪${avgOrder.toLocaleString()}</div><div class="label">📊 المتوسط</div></div>
      <div class="stat-card"><div class="value">${newCustomers.length}</div><div class="label">👤 زبائن جدد</div></div>
      <div class="stat-card"><div class="value">${conversations.length}</div><div class="label">💬 محادثات</div></div>
    </div>
    <div class="section">
      <h2>📅 التفصيل اليومي</h2>
      <table>
        <thead><tr><th>اليوم</th><th>الطلبات</th><th>المبيعات</th></tr></thead>
        <tbody>${Object.entries(dailyBreakdown).map(([day, d]) => `<tr><td>${day}</td><td>${d.count}</td><td>₪${d.revenue.toLocaleString()}</td></tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="footer"><p>ClalMobile — نظام التقارير</p></div>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
