// =====================================================
// ClalMobile — Admin Notification Service
// Send WhatsApp alerts to admin for key events
// =====================================================

import { sendWhatsAppText } from "./whatsapp";

// ADMIN_REPORT_PHONE = رقم مُرسِل التقارير (FROM) — +972537777963
// ADMIN_PERSONAL_PHONE = رقم الأدمن الشخصي (TO) — يستقبل التقارير والإشعارات
const REPORT_FROM = () => process.env.ADMIN_REPORT_PHONE || "+972537777963";
const ADMIN_TO = () => process.env.ADMIN_PERSONAL_PHONE || "+972502404412";
const TEAM_NUMBERS = () => (process.env.TEAM_WHATSAPP_NUMBERS || "").split(",").filter(Boolean);
const BASE_URL = "https://clalmobile.com";

// ===== Send report/notification TO admin FROM report number =====
export async function notifyAdmin(message: string): Promise<void> {
  try {
    await sendWhatsAppText(ADMIN_TO(), message, REPORT_FROM());
  } catch (err) {
    console.error("Admin notify error:", err);
  }
}

// ===== Send to admin personal number FROM report number =====
export async function notifyAdminPersonal(message: string): Promise<void> {
  try {
    await sendWhatsAppText(ADMIN_TO(), message, REPORT_FROM());
  } catch (err) {
    console.error("Admin personal notify error:", err);
  }
}

// ===== Send to all team members FROM report number =====
export async function notifyTeam(message: string): Promise<void> {
  const numbers = TEAM_NUMBERS();
  for (const num of numbers) {
    try {
      await sendWhatsAppText(num.trim(), message, REPORT_FROM());
    } catch (err) {
      console.error(`Team notify error (${num}):`, err);
    }
  }
}

// ===== New Order Alert =====
export async function notifyAdminNewOrder(order: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  source: string;
  items: { name: string; qty: number; price: number }[];
}): Promise<void> {
  const itemsList = order.items
    .map((i) => `  • ${i.name} × ${i.qty} — ₪${i.price.toLocaleString()}`)
    .join("\n");

  const msg =
    `🆕 *طلب جديد!*\n\n` +
    `📦 رقم الطلب: *${order.orderId}*\n` +
    `👤 الزبون: ${order.customerName}\n` +
    `📞 الهاتف: ${order.customerPhone}\n` +
    `💰 المبلغ: *₪${order.total.toLocaleString()}*\n` +
    `📡 المصدر: ${order.source}\n\n` +
    `📋 المنتجات:\n${itemsList}\n\n` +
    `🔗 ${BASE_URL}/crm/orders?search=${order.orderId}`;

  await notifyAdmin(msg);
}

// ===== Contact Form Alert =====
export async function notifyAdminContactForm(contact: {
  name: string;
  phone: string;
  email?: string;
  subject?: string;
  message: string;
}): Promise<void> {
  const msg =
    `📩 *رسالة تواصل جديدة!*\n\n` +
    `👤 الاسم: ${contact.name}\n` +
    `📞 الهاتف: ${contact.phone}\n` +
    (contact.email ? `📧 الإيميل: ${contact.email}\n` : "") +
    (contact.subject ? `📝 الموضوع: ${contact.subject}\n` : "") +
    `\n💬 الرسالة:\n${contact.message.slice(0, 500)}\n\n` +
    `🔗 ${BASE_URL}/crm/customers`;

  await notifyAdmin(msg);
}

// ===== Muhammad Handoff Alert =====
export async function notifyAdminMuhammadHandoff(details: {
  name: string;
  phone: string;
  message: string;
  channel: "webchat" | "whatsapp";
}): Promise<void> {
  const msg =
    `👤 *طلب تحدث مع محمد*\n\n` +
    `🏷️ الاسم: ${details.name}\n` +
    `📞 الهاتف: ${details.phone}\n` +
    `📡 القناة: ${details.channel === "whatsapp" ? "واتساب" : "شات الموقع"}\n\n` +
    `💬 محتوى الطلب:\n${details.message.slice(0, 500)}\n\n` +
    `⏰ الوقت: ${new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" })}`;

  // Send to admin (Muhammad)
  await notifyAdmin(msg);
  await notifyAdminPersonal(msg);
}

// ===== Angry Customer Alert =====
export async function notifyAdminAngryCustomer(details: {
  phone: string;
  name: string;
  message: string;
  sentiment: string;
  channel: "webchat" | "whatsapp";
}): Promise<void> {
  const sentimentEmoji = details.sentiment === "angry" ? "😡🔴" : "😟🟡";
  const msg =
    `${sentimentEmoji} *تنبيه: زبون غاضب!*\n\n` +
    `👤 الاسم: ${details.name}\n` +
    `📞 الهاتف: ${details.phone}\n` +
    `📡 القناة: ${details.channel === "whatsapp" ? "واتساب" : "شات الموقع"}\n\n` +
    `💬 رسالة الزبون:\n"${details.message.slice(0, 500)}"\n\n` +
    `⚠️ يُنصح بالتواصل الفوري مع الزبون!\n` +
    `⏰ الوقت: ${new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" })}`;

  await notifyAdmin(msg);
}

// ===== Daily Report Link =====
export async function sendDailyReportLink(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const msg =
    `📊 *التقرير اليومي — ${today}*\n\n` +
    `اضغط على الرابط لعرض التقرير المفصل:\n\n` +
    `🔗 ${BASE_URL}/api/reports/daily?date=${today}\n\n` +
    `صباح الخير! ☀️`;

  await notifyAdmin(msg);
}

// ===== Weekly Report Link =====
export async function sendWeeklyReportLink(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const msg =
    `📈 *التقرير الأسبوعي — ${today}*\n\n` +
    `اضغط على الرابط لعرض التقرير المفصل:\n\n` +
    `🔗 ${BASE_URL}/api/reports/weekly?date=${today}\n\n` +
    `أسبوع موفق! 🚀`;

  await notifyAdmin(msg);
}
