import { createAdminSupabase } from "@/lib/supabase";

type OrderRow = {
  id: string;
  total: number;
  status: string;
  source: string;
  created_at: string;
  order_items?: { product_name?: string; quantity?: number; price?: number }[];
};

export type DailyReportData = {
  date: string;
  orders: OrderRow[];
  newCustomers: number;
  conversations: { channel?: string; message_count?: number }[];
  handoffs: number;
  totalRevenue: number;
  avgOrderValue: number;
  statusCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
};

export type WeeklyReportData = {
  startDate: string;
  endDate: string;
  orders: OrderRow[];
  prevOrders: { total?: number }[];
  newCustomers: number;
  conversations: { channel?: string; message_count?: number }[];
  handoffs: number;
  totalRevenue: number;
  prevRevenue: number;
  revenueChange: number;
  ordersChange: number;
  avgOrderValue: number;
  statusCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://clalmobile.com";

function toCurrency(n: number): string {
  return `₪${Number(n || 0).toLocaleString()}`;
}

function topProductsFromOrders(orders: OrderRow[]) {
  const map: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const o of orders) {
    for (const item of o.order_items || []) {
      const name = item.product_name || "Unknown";
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      map[name].qty += qty;
      map[name].revenue += qty * price;
    }
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function countsBy<T extends string>(rows: OrderRow[], pick: (r: OrderRow) => T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = pick(row) || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export async function getDailyReportData(date: string): Promise<DailyReportData> {
  const db = createAdminSupabase();
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const [ordersRes, customersRes, conversationsRes, handoffsRes] = await Promise.all([
    db.from("orders").select("*, order_items(*)").gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false }),
    db.from("customers").select("id").gte("created_at", startOfDay).lte("created_at", endOfDay),
    db.from("bot_conversations").select("channel, message_count").gte("created_at", startOfDay).lte("created_at", endOfDay),
    db.from("bot_handoffs").select("id").gte("created_at", startOfDay).lte("created_at", endOfDay),
  ]);

  const orders = (ordersRes.data || []) as OrderRow[];
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avgOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;

  return {
    date,
    orders,
    newCustomers: (customersRes.data || []).length,
    conversations: (conversationsRes.data || []) as { channel?: string; message_count?: number }[],
    handoffs: (handoffsRes.data || []).length,
    totalRevenue,
    avgOrderValue,
    statusCounts: countsBy(orders, (o) => o.status || "new"),
    sourceCounts: countsBy(orders, (o) => o.source || "store"),
    topProducts: topProductsFromOrders(orders),
  };
}

export async function getWeeklyReportData(endDate: string): Promise<WeeklyReportData> {
  const db = createAdminSupabase();
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  const prevWeekEnd = new Date(start);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const [ordersRes, prevOrdersRes, customersRes, conversationsRes, handoffsRes] = await Promise.all([
    db.from("orders").select("*, order_items(*)").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).order("created_at", { ascending: false }),
    db.from("orders").select("total").gte("created_at", prevWeekStart.toISOString()).lte("created_at", prevWeekEnd.toISOString()),
    db.from("customers").select("id").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
    db.from("bot_conversations").select("channel, message_count").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
    db.from("bot_handoffs").select("id").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
  ]);

  const orders = (ordersRes.data || []) as OrderRow[];
  const prevOrders = (prevOrdersRes.data || []) as { total?: number }[];
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const prevRevenue = prevOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
  const ordersChange = prevOrders.length > 0 ? Math.round(((orders.length - prevOrders.length) / prevOrders.length) * 100) : 0;

  return {
    startDate: start.toISOString().split("T")[0],
    endDate,
    orders,
    prevOrders,
    newCustomers: (customersRes.data || []).length,
    conversations: (conversationsRes.data || []) as { channel?: string; message_count?: number }[],
    handoffs: (handoffsRes.data || []).length,
    totalRevenue,
    prevRevenue,
    revenueChange,
    ordersChange,
    avgOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0,
    statusCounts: countsBy(orders, (o) => o.status || "new"),
    sourceCounts: countsBy(orders, (o) => o.source || "store"),
    topProducts: topProductsFromOrders(orders),
  };
}

export function buildDailyReportHtml(data: DailyReportData): string {
  const botMessages = data.conversations.reduce((sum, c) => sum + Number(c.message_count || 0), 0);
  const whatsapp = data.conversations.filter((c) => c.channel === "whatsapp").length;
  const webchat = data.conversations.filter((c) => c.channel === "webchat").length;
  const rows = data.orders.slice(0, 30).map((o) => {
    const products = (o.order_items || []).map((i) => i.product_name).filter(Boolean).join("، ");
    return `<tr><td>${o.id}</td><td>${products || "—"}</td><td>${toCurrency(o.total)}</td><td>${o.status}</td><td>${o.source || "store"}</td></tr>`;
  }).join("");

  const topRows = data.topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.qty}</td><td>${toCurrency(p.revenue)}</td></tr>`).join("");

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>التقرير اليومي ${data.date}</title>
  <style>
  body{font-family:Tahoma,Arial,sans-serif;background:#0c111d;color:#e5e7eb;padding:22px}
  .wrap{max-width:1000px;margin:0 auto}.card{background:#151b2d;border:1px solid #2a334a;border-radius:12px;padding:16px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
  h1{margin:0 0 6px;color:#f43f5e}h2{margin:0 0 10px;color:#f8fafc}small{color:#9ca3af}
  .v{font-size:24px;font-weight:800;color:#fb7185}.l{font-size:12px;color:#9ca3af}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #2a334a;text-align:right}
  th{color:#cbd5e1;background:#1d2538}
  </style></head><body><div class="wrap">
  <div class="card"><h1>📊 التقرير اليومي</h1><small>${data.date}</small></div>
  <div class="grid">
   <div class="card"><div class="v">${data.orders.length}</div><div class="l">إجمالي الطلبات</div></div>
   <div class="card"><div class="v">${toCurrency(data.totalRevenue)}</div><div class="l">إجمالي الإيراد</div></div>
   <div class="card"><div class="v">${toCurrency(data.avgOrderValue)}</div><div class="l">متوسط الطلب</div></div>
   <div class="card"><div class="v">${data.newCustomers}</div><div class="l">زبائن جدد</div></div>
   <div class="card"><div class="v">${botMessages}</div><div class="l">رسائل البوت</div></div>
   <div class="card"><div class="v">${whatsapp}/${webchat}</div><div class="l">واتساب / ويب</div></div>
   <div class="card"><div class="v">${data.handoffs}</div><div class="l">تحويل لموظف</div></div>
  </div>
  <div class="card"><h2>🏆 أفضل المنتجات</h2><table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>${topRows || "<tr><td colspan='4'>لا توجد بيانات</td></tr>"}</tbody></table></div>
  <div class="card"><h2>📦 آخر الطلبات</h2><table><thead><tr><th>رقم الطلب</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th>المصدر</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>لا توجد طلبات</td></tr>"}</tbody></table></div>
  <div class="card"><small>لوحة الإدارة: ${SITE_URL}/admin</small></div>
  </div></body></html>`;
}

export function buildWeeklyReportHtml(data: WeeklyReportData): string {
  const botMessages = data.conversations.reduce((sum, c) => sum + Number(c.message_count || 0), 0);
  const topRows = data.topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.qty}</td><td>${toCurrency(p.revenue)}</td></tr>`).join("");
  const orderRows = data.orders.slice(0, 50).map((o) => {
    return `<tr><td>${o.id}</td><td>${toCurrency(o.total)}</td><td>${o.status}</td><td>${o.source || "store"}</td><td>${new Date(o.created_at).toLocaleDateString("ar-EG")}</td></tr>`;
  }).join("");

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>التقرير الأسبوعي ${data.startDate} - ${data.endDate}</title>
  <style>
  body{font-family:Tahoma,Arial,sans-serif;background:#0b1020;color:#e5e7eb;padding:22px}
  .wrap{max-width:1000px;margin:0 auto}.card{background:#151b2d;border:1px solid #2a334a;border-radius:12px;padding:16px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
  h1{margin:0 0 6px;color:#f43f5e}h2{margin:0 0 10px;color:#f8fafc}small{color:#9ca3af}
  .v{font-size:24px;font-weight:800;color:#fb7185}.l{font-size:12px;color:#9ca3af}.chg{font-size:11px;color:#cbd5e1}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #2a334a;text-align:right}
  th{color:#cbd5e1;background:#1d2538}
  </style></head><body><div class="wrap">
  <div class="card"><h1>📈 التقرير الأسبوعي</h1><small>${data.startDate} → ${data.endDate}</small></div>
  <div class="grid">
   <div class="card"><div class="v">${data.orders.length}</div><div class="l">إجمالي الطلبات</div><div class="chg">${data.ordersChange >= 0 ? "↑" : "↓"} ${Math.abs(data.ordersChange)}%</div></div>
   <div class="card"><div class="v">${toCurrency(data.totalRevenue)}</div><div class="l">إجمالي الإيراد</div><div class="chg">${data.revenueChange >= 0 ? "↑" : "↓"} ${Math.abs(data.revenueChange)}%</div></div>
   <div class="card"><div class="v">${toCurrency(data.avgOrderValue)}</div><div class="l">متوسط الطلب</div></div>
   <div class="card"><div class="v">${data.newCustomers}</div><div class="l">زبائن جدد</div></div>
   <div class="card"><div class="v">${botMessages}</div><div class="l">رسائل البوت</div></div>
   <div class="card"><div class="v">${data.handoffs}</div><div class="l">تحويل لموظف</div></div>
  </div>
  <div class="card"><h2>🏆 أفضل المنتجات</h2><table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>${topRows || "<tr><td colspan='4'>لا توجد بيانات</td></tr>"}</tbody></table></div>
  <div class="card"><h2>📦 الطلبات</h2><table><thead><tr><th>رقم الطلب</th><th>المبلغ</th><th>الحالة</th><th>المصدر</th><th>التاريخ</th></tr></thead><tbody>${orderRows || "<tr><td colspan='5'>لا توجد طلبات</td></tr>"}</tbody></table></div>
  </div></body></html>`;
}

async function createPdfFromRows(title: string, subtitle: string, rows: string[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595.28, 841.89]);
  let y = 800;

  const drawLine = (text: string, size = 11, color = rgb(0.1, 0.1, 0.1)) => {
    if (y < 40) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(text, { x: 40, y, size, font, color });
    y -= size + 6;
  };

  drawLine(title, 18, rgb(0.75, 0.06, 0.2));
  drawLine(subtitle, 11, rgb(0.3, 0.3, 0.3));
  y -= 6;
  for (const row of rows) drawLine(row, 10);
  return doc.save();
}

export async function buildDailyReportPdf(data: DailyReportData): Promise<Uint8Array> {
  const rows: string[] = [
    `Orders: ${data.orders.length}`,
    `Revenue: ${toCurrency(data.totalRevenue)}`,
    `Average order: ${toCurrency(data.avgOrderValue)}`,
    `New customers: ${data.newCustomers}`,
    `Handoffs: ${data.handoffs}`,
    "",
    "Top products:",
    ...data.topProducts.map((p, i) => `${i + 1}. ${p.name} | qty ${p.qty} | ${toCurrency(p.revenue)}`),
    "",
    "Recent orders:",
    ...data.orders.slice(0, 40).map((o) => `${o.id} | ${toCurrency(o.total)} | ${o.status} | ${o.source || "store"}`),
  ];
  return createPdfFromRows("ClalMobile Daily Report", `Date: ${data.date}`, rows);
}

export async function buildWeeklyReportPdf(data: WeeklyReportData): Promise<Uint8Array> {
  const rows: string[] = [
    `Orders: ${data.orders.length} (${data.ordersChange}%)`,
    `Revenue: ${toCurrency(data.totalRevenue)} (${data.revenueChange}%)`,
    `Average order: ${toCurrency(data.avgOrderValue)}`,
    `New customers: ${data.newCustomers}`,
    `Handoffs: ${data.handoffs}`,
    "",
    "Top products:",
    ...data.topProducts.map((p, i) => `${i + 1}. ${p.name} | qty ${p.qty} | ${toCurrency(p.revenue)}`),
    "",
    "Orders snapshot:",
    ...data.orders.slice(0, 60).map((o) => `${o.id} | ${toCurrency(o.total)} | ${o.status} | ${new Date(o.created_at).toISOString().slice(0, 10)}`),
  ];
  return createPdfFromRows("ClalMobile Weekly Report", `Range: ${data.startDate} -> ${data.endDate}`, rows);
}
