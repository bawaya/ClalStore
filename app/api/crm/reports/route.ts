export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "daily";
  const dateParam = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  try {
    if (type === "weekly") {
      const d = new Date(dateParam);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startDate = weekStart.toISOString().split("T")[0];
      const endDate = weekEnd.toISOString().split("T")[0];
      return buildReport(supabase, `${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`, `${startDate} — ${endDate}`, "أسبوعي");
    }

    return buildReport(supabase, `${dateParam}T00:00:00.000Z`, `${dateParam}T23:59:59.999Z`, dateParam, "يومي");
  } catch {
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

async function buildReport(supabase: any, start: string, end: string, label: string, typeLabel: string) {
  const [ordersRes, customersRes, conversationsRes, handoffsRes] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
    supabase.from("customers").select("id").gte("created_at", start).lte("created_at", end),
    supabase.from("bot_conversations").select("id, channel, message_count").gte("created_at", start).lte("created_at", end),
    supabase.from("bot_handoffs").select("id").gte("created_at", start).lte("created_at", end),
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
  <title>التقرير ال${typeLabel} — ${label}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#09090b;color:#e4e4e7;line-height:1.6}
    .c{max-width:800px;margin:0 auto;padding:24px 16px}
    .hd{text-align:center;margin-bottom:32px;padding:28px;background:linear-gradient(135deg,#18082e,#1a0a2e);border-radius:20px;border:1px solid rgba(124,58,237,0.2)}
    .hd h1{font-size:26px;background:linear-gradient(135deg,#a78bfa,#c41040);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
    .hd .dt{font-size:16px;color:#a1a1aa}
    .sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px}
    .sc{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:16px;text-align:center}
    .sc .v{font-size:30px;font-weight:800;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sc .l{font-size:12px;color:#71717a;margin-top:4px}
    .sec{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;margin-bottom:14px}
    .sec h2{font-size:16px;color:#e4e4e7;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:rgba(124,58,237,0.08);color:#a1a1aa;padding:10px 8px;text-align:right;font-weight:600}
    td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.04)}
    tr:hover td{background:rgba(124,58,237,0.03)}
    .b{display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600}
    .b-new{background:rgba(96,165,250,0.15);color:#60a5fa}.b-approved{background:rgba(74,222,128,0.15);color:#4ade80}
    .b-processing{background:rgba(251,191,36,0.15);color:#fbbf24}.b-shipped{background:rgba(192,132,252,0.15);color:#c084fc}
    .b-delivered{background:rgba(34,197,94,0.15);color:#22c55e}.b-cancelled{background:rgba(248,113,113,0.15);color:#f87171}
    .b-rejected{background:rgba(248,113,113,0.15);color:#f87171}
    .em{text-align:center;color:#52525b;padding:24px}
    .ft{text-align:center;margin-top:28px;color:#3f3f46;font-size:11px}
    .ft a{color:#7c3aed;text-decoration:none}
  </style>
</head>
<body>
  <div class="c">
    <div class="hd"><h1>📊 التقرير ال${typeLabel}</h1><div class="dt">${label}</div></div>
    <div class="sg">
      <div class="sc"><div class="v">${orders.length}</div><div class="l">📦 طلبات</div></div>
      <div class="sc"><div class="v">₪${totalRevenue.toLocaleString()}</div><div class="l">💰 المبيعات</div></div>
      <div class="sc"><div class="v">₪${avgOrderValue.toLocaleString()}</div><div class="l">📊 متوسط الطلب</div></div>
      <div class="sc"><div class="v">${newCustomers.length}</div><div class="l">👤 زبائن جدد</div></div>
      <div class="sc"><div class="v">${conversations.length}</div><div class="l">💬 محادثات</div></div>
      <div class="sc"><div class="v">${botMessages}</div><div class="l">📨 رسائل</div></div>
      <div class="sc"><div class="v">${handoffs.length}</div><div class="l">🔄 تحويل لموظف</div></div>
      <div class="sc"><div class="v">${deviceOrders.length}/${accessoryOrders.length}</div><div class="l">📱 أجهزة/إكسسوارات</div></div>
    </div>
    <div class="sec">
      <h2>📦 الطلبات (${orders.length})</h2>
      ${orders.length === 0 ? '<div class="em">لا توجد طلبات</div>' : `<div style="overflow-x:auto"><table>
        <thead><tr><th>رقم الطلب</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th>المصدر</th><th>الوقت</th></tr></thead>
        <tbody>${orders.map((o: any) => {
          const items = (o.order_items || []).map((i: any) => i.product_name).join("، ");
          return `<tr><td><strong>${o.id}</strong></td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items || "—"}</td><td><strong>₪${Number(o.total).toLocaleString()}</strong></td><td><span class="b b-${o.status}">${statusLabels[o.status] || o.status}</span></td><td>${o.source || "store"}</td><td>${new Date(o.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</td></tr>`;
        }).join("")}</tbody></table></div>`}
    </div>
    <div class="sec"><h2>📡 مصادر الطلبات</h2><div class="sg">${Object.entries(sourceCounts).map(([s, c]) => `<div class="sc"><div class="v">${c}</div><div class="l">${s}</div></div>`).join("") || '<div class="em">لا توجد بيانات</div>'}</div></div>
    <div class="sec"><h2>🤖 البوت</h2><div class="sg"><div class="sc"><div class="v">${whatsappConvos}</div><div class="l">واتساب</div></div><div class="sc"><div class="v">${webchatConvos}</div><div class="l">شات الموقع</div></div><div class="sc"><div class="v">${handoffs.length}</div><div class="l">تحويل لموظف</div></div></div></div>
    <div class="sec"><h2>📋 حالات الطلبات</h2><div class="sg">${Object.entries(statusCounts).map(([s, c]) => `<div class="sc"><div class="v">${c}</div><div class="l">${statusLabels[s] || s}</div></div>`).join("") || '<div class="em">لا توجد طلبات</div>'}</div></div>
    <div class="ft"><p>ClalMobile — نظام التقارير</p><p><a href="https://clalmobile.com/crm">🔗 CRM</a> | <a href="https://clalmobile.com/admin">⚙️ الإدارة</a></p></div>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
