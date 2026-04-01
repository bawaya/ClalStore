// =====================================================
// ClalMobile — Admin Notification Service
// Always sends via approved WhatsApp templates to bypass
// the 24-hour session window restriction.
//
// Templates required in yCloud (see bottom of file):
//   clal_new_order, clal_contact_form, clal_handoff,
//   clal_angry_cust, clal_new_msg, clal_order_done,
//   clal_daily_report, clal_weekly_report, clal_admin_alert
// =====================================================

import { sendWhatsAppTemplate } from "./whatsapp";
import { getIntegrationConfig } from "@/lib/integrations/hub";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://clalmobile.com";

async function getNotifyTargets() {
  const waCfg = await getIntegrationConfig("whatsapp");
  const adminTo = waCfg.admin_phone || process.env.ADMIN_PERSONAL_PHONE || "+972502404412";
  const teamRaw = waCfg.team_whatsapp_numbers || process.env.TEAM_WHATSAPP_NUMBERS || "";
  const teamNumbers = String(teamRaw).split(",").map((n) => n.trim()).filter(Boolean);
  return { adminTo, teamNumbers };
}

/** Send a template to admin — always uses template (no 24h window issue) */
async function sendTemplateToAdmin(
  templateName: string,
  params: string[]
): Promise<{ sent: boolean }> {
  const { adminTo } = await getNotifyTargets();
  try {
    await sendWhatsAppTemplate(adminTo, templateName, params);
    return { sent: true };
  } catch (err) {
    console.error(`[AdminNotify] Template "${templateName}" failed:`, err);
    return { sent: false };
  }
}

/** Send a template to all team members */
async function sendTemplateToTeam(
  templateName: string,
  params: string[]
): Promise<{ sent: boolean }> {
  const { teamNumbers } = await getNotifyTargets();
  let anySent = false;
  for (const num of teamNumbers) {
    try {
      await sendWhatsAppTemplate(num, templateName, params);
      anySent = true;
    } catch (err) {
      console.error(`[AdminNotify] Team template "${templateName}" failed for ${num}:`, err);
    }
  }
  return { sent: anySent || teamNumbers.length === 0 };
}

// ===== Generic admin alert (for backward compat) =====
export async function notifyAdmin(message: string): Promise<{ sent: boolean }> {
  return sendTemplateToAdmin("clal_admin_alert", [message.slice(0, 1024)]);
}

export async function notifyTeam(message: string): Promise<{ sent: boolean }> {
  return sendTemplateToTeam("clal_admin_alert", [message.slice(0, 1024)]);
}

// ===== New Order Alert =====
// Template: clal_new_order  (4 params)
export async function notifyAdminNewOrder(order: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  source: string;
  items: { name: string; qty: number; price: number }[];
}): Promise<{ sent: boolean }> {
  const itemsList = order.items
    .map((i) => `• ${i.name} × ${i.qty} — ₪${i.price.toLocaleString()}`)
    .join("\n")
    .slice(0, 500);

  return sendTemplateToAdmin("clal_new_order", [
    order.orderId,
    `${order.customerName} | ${order.customerPhone}\nالمبلغ: ₪${order.total.toLocaleString()} | المصدر: ${order.source}`,
    itemsList,
    `${BASE_URL}/crm/orders?search=${order.orderId}`,
  ]);
}

// ===== Contact Form Alert =====
// Template: clal_contact_form  (3 params)
export async function notifyAdminContactForm(contact: {
  name: string;
  phone: string;
  email?: string;
  subject?: string;
  message: string;
}): Promise<{ sent: boolean }> {
  const senderInfo = [contact.name, contact.phone, contact.email].filter(Boolean).join(" | ");
  const msgContent = contact.subject
    ? `الموضوع: ${contact.subject}\n${contact.message.slice(0, 400)}`
    : contact.message.slice(0, 450);

  return sendTemplateToAdmin("clal_contact_form", [
    senderInfo,
    msgContent,
    `${BASE_URL}/crm/customers`,
  ]);
}

// ===== Muhammad Handoff Alert =====
// Template: clal_handoff  (3 params)
export async function notifyAdminMuhammadHandoff(details: {
  name: string;
  phone: string;
  message: string;
  channel: "webchat" | "whatsapp";
}): Promise<{ sent: boolean }> {
  const time = new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" });
  const channel = details.channel === "whatsapp" ? "واتساب" : "شات الموقع";

  return sendTemplateToAdmin("clal_handoff", [
    `${details.name} | ${details.phone} | ${channel}`,
    details.message.slice(0, 500),
    time,
  ]);
}

// ===== Angry Customer Alert =====
// Template: clal_angry_cust  (3 params)
export async function notifyAdminAngryCustomer(details: {
  phone: string;
  name: string;
  message: string;
  sentiment: string;
  channel: "webchat" | "whatsapp";
}): Promise<{ sent: boolean }> {
  const time = new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" });
  const channel = details.channel === "whatsapp" ? "واتساب" : "شات الموقع";

  return sendTemplateToAdmin("clal_angry_cust", [
    `${details.name} | ${details.phone} | ${channel}`,
    details.message.slice(0, 500),
    time,
  ]);
}

// ===== New Incoming WhatsApp Message Alert =====
// Template: clal_new_msg  (3 params)
// Rate-limited: max 1 notification per phone per 10 minutes
const _msgNotifyCache = new Map<string, number>();
const MSG_NOTIFY_COOLDOWN = 10 * 60 * 1000;

export async function notifyAdminNewMessage(details: {
  phone: string;
  name: string;
  preview: string;
  isMedia?: boolean;
}): Promise<{ sent: boolean }> {
  const cacheKey = details.phone.replace(/[^0-9]/g, "");
  const lastNotified = _msgNotifyCache.get(cacheKey) || 0;

  if (Date.now() - lastNotified < MSG_NOTIFY_COOLDOWN) return { sent: false };
  _msgNotifyCache.set(cacheKey, Date.now());

  if (_msgNotifyCache.size > 200) {
    const cutoff = Date.now() - MSG_NOTIFY_COOLDOWN;
    for (const [k, v] of _msgNotifyCache) {
      if (v < cutoff) _msgNotifyCache.delete(k);
    }
  }

  const time = new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" });
  const mediaLabel = details.isMedia ? " [وسائط]" : "";
  const preview = `${details.preview.slice(0, 200)}${mediaLabel}`;

  return sendTemplateToAdmin("clal_new_msg", [
    `${details.name || "مجهول"} (${details.phone})`,
    preview,
    `${time}\n${BASE_URL}/crm/inbox`,
  ]);
}

// ===== Daily Report =====
// Template: clal_daily_report  (2 params)
export async function sendDailyReportLink(): Promise<{ sent: boolean }> {
  const today = new Date().toISOString().split("T")[0];
  return sendTemplateToAdmin("clal_daily_report", [
    today,
    `${BASE_URL}/api/reports/daily?date=${today}`,
  ]);
}

// ===== Weekly Report =====
// Template: clal_weekly_report  (2 params)
export async function sendWeeklyReportLink(): Promise<{ sent: boolean }> {
  const today = new Date().toISOString().split("T")[0];
  return sendTemplateToAdmin("clal_weekly_report", [
    today,
    `${BASE_URL}/api/reports/weekly?date=${today}`,
  ]);
}

// =====================================================
// WHATSAPP TEMPLATES — أنشئها في yCloud Dashboard
// Template Language: Arabic (ar)
// Category: UTILITY
// =====================================================
//
// 1. clal_admin_alert  (generic — 1 param)
//    Body:
//    {{1}}
//
// 2. clal_new_order  (7 params)
//    Body:
//    طلب جديد 🆕
//
//    رقم الطلب: {{1}}
//    الزبون: {{2}} | {{3}}
//    المبلغ: {{4}}
//    المصدر: {{5}}
//
//    المنتجات:
//    {{6}}
//
//    {{7}}
//
// 3. clal_order_done  (5 params)
//    Body:
//    طلب مكتمل ✅
//
//    رقم الطلب: {{1}}
//    الزبون: {{2}}
//    المبلغ: {{3}}
//    الحالة: {{4}}
//
//    {{5}}
//
// 4. clal_contact_form  (6 params)
//    Body:
//    رسالة تواصل جديدة 📩
//
//    الاسم: {{1}}
//    الهاتف: {{2}}
//    الإيميل: {{3}}
//    الموضوع: {{4}}
//
//    الرسالة:
//    {{5}}
//
//    {{6}}
//
// 5. clal_handoff  (5 params)
//    Body:
//    طلب تحدث مع محمد 👤
//
//    الاسم: {{1}}
//    الهاتف: {{2}}
//    القناة: {{3}}
//
//    محتوى الطلب:
//    {{4}}
//
//    الوقت: {{5}}
//
// 6. clal_angry_cust  (5 params)
//    Body:
//    تنبيه: زبون غاضب ⚠️
//
//    الاسم: {{1}}
//    الهاتف: {{2}}
//    القناة: {{3}}
//
//    رسالة الزبون:
//    "{{4}}"
//
//    الوقت: {{5}}
//
// 7. clal_new_msg  (5 params)
//    Body:
//    رسالة واتساب جديدة 💬
//
//    من: {{1}} ({{2}})
//    "{{3}}"
//
//    الوقت: {{4}}
//    {{5}}
//
// 8. clal_daily_report  (2 params)
//    Body:
//    التقرير اليومي 📊 — {{1}}
//
//    اضغط على الرابط لعرض التقرير المفصل:
//    {{2}}
//
//    صباح الخير! ☀️
//
// 9. clal_weekly_report  (2 params)
//    Body:
//    التقرير الأسبوعي 📈 — {{1}}
//
//    اضغط على الرابط لعرض التقرير المفصل:
//    {{2}}
//
//    أسبوع موفق! 🚀
// =====================================================
