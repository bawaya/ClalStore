// =====================================================
// ClalMobile — Admin Notification Service
// Send WhatsApp alerts to admin for key events
// =====================================================

import { sendWhatsAppText, sendWhatsAppTemplate } from "./whatsapp";
import { getIntegrationConfig, getProvider, type EmailProvider } from "@/lib/integrations/hub";
import {
  buildDailyReportHtml,
  buildDailyReportPdf,
  buildWeeklyReportHtml,
  buildWeeklyReportPdf,
  getDailyReportData,
  getWeeklyReportData,
} from "@/lib/reports/service";

// ADMIN_REPORT_PHONE = رقم مُرسِل التقارير (FROM) — +972537777963
// ADMIN_PERSONAL_PHONE = رقم الأدمن الشخصي (TO) — يستقبل التقارير والإشعارات
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://clalmobile.com";

async function getNotifyTargets() {
  const waCfg = await getIntegrationConfig("whatsapp");
  const reportFromId = waCfg.reports_phone_id || process.env.ADMIN_REPORT_PHONE_ID || "";
  const adminTo = waCfg.admin_phone || process.env.ADMIN_PERSONAL_PHONE || "+972502404412";
  const teamRaw = waCfg.team_whatsapp_numbers || process.env.TEAM_WHATSAPP_NUMBERS || "";
  const teamNumbers = String(teamRaw)
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return { reportFromId, adminTo, teamNumbers };
}

async function sendAdminTemplate(
  to: string,
  templateName: string,
  params: string[],
  reportFromId?: string
): Promise<void> {
  await sendWhatsAppTemplate(to, templateName, params, reportFromId || undefined);
}

/** Send message to admin — try text first, fall back to template if 24h window expired */
async function sendToAdmin(
  message: string,
  templateName = "clal_admin_alert",
  templateParams?: string[],
): Promise<void> {
  const targets = await getNotifyTargets();
  const to = targets.adminTo;
  const fallbackParams = templateParams && templateParams.length > 0
    ? templateParams
    : [message.slice(0, 1024)];
  try {
    // Force admin/report notifications to use reports sender id when configured.
    const res = await sendWhatsAppText(to, message, targets.reportFromId || undefined);
    // yCloud returns error for 24h window violations
    if (res?.error?.code || res?.errorCode) {
      console.warn("[AdminNotify] Text failed (possibly 24h window), trying template...");
      await sendAdminTemplate(to, templateName, fallbackParams, targets.reportFromId);
    }
  } catch (err: any) {
    console.error("[AdminNotify] Text send error, trying template fallback:", err.message);
    try {
      await sendAdminTemplate(to, templateName, fallbackParams, targets.reportFromId);
    } catch (templateErr) {
      console.error("[AdminNotify] Template fallback also failed:", templateErr);
    }
  }
}

// ===== Send report/notification TO admin FROM report number =====
export async function notifyAdmin(message: string): Promise<void> {
  await sendToAdmin(message);
}

// ===== Send to admin personal number FROM report number =====
export async function notifyAdminPersonal(message: string): Promise<void> {
  await sendToAdmin(message);
}

// ===== Send to all team members FROM report number =====
export async function notifyTeam(message: string): Promise<void> {
  const { teamNumbers, reportFromId } = await getNotifyTargets();
  const numbers = teamNumbers;
  for (const num of numbers) {
    try {
      await sendWhatsAppText(num.trim(), message, reportFromId || undefined);
    } catch (err) {
      console.error(`Team notify error (${num}):`, err);
      // Team members — try template as fallback
      try {
        await sendAdminTemplate(num.trim(), "clal_admin_alert", [message.slice(0, 1024)], reportFromId);
      } catch { /* silent */ }
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

  await sendToAdmin(msg, "clal_admin_new_order", [
    order.orderId,
    order.customerName,
    `₪${order.total.toLocaleString()}`,
    order.source,
  ]);
}

// ===== Order Completed Alert =====
export async function notifyAdminOrderCompleted(order: {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  status: string;
}): Promise<void> {
  const msg =
    `✅ *طلب مكتمل*\n\n` +
    `📦 رقم الطلب: *${order.orderId}*\n` +
    `👤 الزبون: ${order.customerName}\n` +
    (order.customerPhone ? `📞 الهاتف: ${order.customerPhone}\n` : "") +
    `💰 المبلغ: *₪${order.total.toLocaleString()}*\n` +
    `📌 الحالة: ${order.status}\n\n` +
    `🔗 ${BASE_URL}/crm/orders?search=${order.orderId}`;

  await sendToAdmin(msg, "clal_admin_order_completed", [
    order.orderId,
    order.customerName,
    `₪${order.total.toLocaleString()}`,
    order.status,
  ]);
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

  await sendToAdmin(msg, "clal_admin_contact", [
    contact.name,
    contact.phone,
    (contact.subject || "بدون موضوع").slice(0, 60),
  ]);
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

  await sendToAdmin(msg, "clal_admin_handoff", [
    details.name,
    details.phone,
    details.channel === "whatsapp" ? "واتساب" : "شات الموقع",
  ]);
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

  await sendToAdmin(msg, "clal_admin_angry_customer", [
    details.name,
    details.phone,
    details.channel === "whatsapp" ? "واتساب" : "شات الموقع",
  ]);
}

// ===== New Incoming Message Alert =====
// Rate-limited: max 1 notification per phone per 10 minutes
const _msgNotifyCache = new Map<string, number>();
const MSG_NOTIFY_COOLDOWN = 10 * 60 * 1000; // 10 minutes

export async function notifyAdminNewMessage(details: {
  phone: string;
  name: string;
  preview: string;
  isMedia?: boolean;
}): Promise<void> {
  const cacheKey = details.phone.replace(/[^0-9]/g, "");
  const lastNotified = _msgNotifyCache.get(cacheKey) || 0;

  if (Date.now() - lastNotified < MSG_NOTIFY_COOLDOWN) return;
  _msgNotifyCache.set(cacheKey, Date.now());

  // Cleanup old entries (keep cache small)
  if (_msgNotifyCache.size > 200) {
    const cutoff = Date.now() - MSG_NOTIFY_COOLDOWN;
    for (const [k, v] of _msgNotifyCache) {
      if (v < cutoff) _msgNotifyCache.delete(k);
    }
  }

  const mediaLabel = details.isMedia ? " 📎" : "";
  const msg =
    `💬 *رسالة واتساب جديدة!*${mediaLabel}\n\n` +
    `👤 ${details.name || "مجهول"}\n` +
    `📞 ${details.phone}\n` +
    `💬 "${details.preview.slice(0, 200)}"\n\n` +
    `⏰ ${new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" })}\n` +
    `🔗 ${BASE_URL}/crm/inbox`;

  await sendToAdmin(msg, "clal_admin_new_message", [
    (details.name || "مجهول").slice(0, 60),
    details.phone,
    details.isMedia ? "وسائط" : "نص",
  ]);
}

// ===== Daily Report Link =====
export async function sendDailyReportLink(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const msg =
    `📊 *التقرير اليومي — ${today}*\n\n` +
    `اضغط على الرابط لعرض التقرير المفصل:\n\n` +
    `🔗 ${BASE_URL}/api/reports/daily?date=${today}\n` +
    `📄 PDF: ${BASE_URL}/api/reports/daily?date=${today}&format=pdf\n\n` +
    `صباح الخير! ☀️`;

  await sendToAdmin(msg, "clal_admin_daily_report", [
    today,
    `${BASE_URL}/api/reports/daily?date=${today}`,
    `${BASE_URL}/api/reports/daily?date=${today}&format=pdf`,
  ]);

  try {
    const email = await getProvider<EmailProvider>("email");
    if (!email) return;
    const waCfg = await getIntegrationConfig("whatsapp");
    const to = waCfg.reports_email || waCfg.completed_orders_email || "bawaya@icloud.com";
    const data = await getDailyReportData(today);
    const html = buildDailyReportHtml(data);
    const pdf = await buildDailyReportPdf(data);
    await email.send({
      to,
      subject: `📊 التقرير اليومي - ${today}`,
      html,
      attachments: [{
        filename: `daily-report-${today}.pdf`,
        content: Buffer.from(pdf).toString("base64"),
        contentType: "application/pdf",
      }],
    });
  } catch (err) {
    console.error("Daily report email failed:", err);
  }
}

// ===== Weekly Report Link =====
export async function sendWeeklyReportLink(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const msg =
    `📈 *التقرير الأسبوعي — ${today}*\n\n` +
    `اضغط على الرابط لعرض التقرير المفصل:\n\n` +
    `🔗 ${BASE_URL}/api/reports/weekly?date=${today}\n` +
    `📄 PDF: ${BASE_URL}/api/reports/weekly?date=${today}&format=pdf\n\n` +
    `أسبوع موفق! 🚀`;

  await sendToAdmin(msg, "clal_admin_weekly_report", [
    today,
    `${BASE_URL}/api/reports/weekly?date=${today}`,
    `${BASE_URL}/api/reports/weekly?date=${today}&format=pdf`,
  ]);

  try {
    const email = await getProvider<EmailProvider>("email");
    if (!email) return;
    const waCfg = await getIntegrationConfig("whatsapp");
    const to = waCfg.reports_email || waCfg.completed_orders_email || "bawaya@icloud.com";
    const data = await getWeeklyReportData(today);
    const html = buildWeeklyReportHtml(data);
    const pdf = await buildWeeklyReportPdf(data);
    await email.send({
      to,
      subject: `📈 التقرير الأسبوعي - ${data.startDate} إلى ${data.endDate}`,
      html,
      attachments: [{
        filename: `weekly-report-${data.startDate}-to-${data.endDate}.pdf`,
        content: Buffer.from(pdf).toString("base64"),
        contentType: "application/pdf",
      }],
    });
  } catch (err) {
    console.error("Weekly report email failed:", err);
  }
}
