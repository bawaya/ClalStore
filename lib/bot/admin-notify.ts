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
import { getPublicSiteUrl } from "@/lib/public-site-url";

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
): Promise<{ success: boolean; error?: string }> {
  const { adminTo } = await getNotifyTargets();
  try {
    await sendWhatsAppTemplate(adminTo, templateName, params);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AdminNotify] Template "${templateName}" failed:`, err);
    return { success: false, error: msg };
  }
}

/** Send a template to all team members */
async function sendTemplateToTeam(
  templateName: string,
  params: string[]
): Promise<{ success: boolean; failed: string[] }> {
  const { teamNumbers } = await getNotifyTargets();
  const failed: string[] = [];
  for (const num of teamNumbers) {
    try {
      await sendWhatsAppTemplate(num, templateName, params);
    } catch (err) {
      console.error(`[AdminNotify] Team template "${templateName}" failed for ${num}:`, err);
      failed.push(num);
    }
  }
  return { success: failed.length === 0, failed };
}

// ===== Generic admin alert (for backward compat) =====
export async function notifyAdmin(message: string): Promise<void> {
  await sendTemplateToAdmin("clal_admin_alert", [message.slice(0, 1024)]);
}

export async function notifyAdminPersonal(message: string): Promise<void> {
  await sendTemplateToAdmin("clal_admin_alert", [message.slice(0, 1024)]);
}

export async function notifyTeam(message: string): Promise<void> {
  await sendTemplateToTeam("clal_admin_alert", [message.slice(0, 1024)]);
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
}): Promise<void> {
  const itemsList = order.items
    .map((i) => `• ${i.name} × ${i.qty} — ₪${i.price.toLocaleString()}`)
    .join("\n")
    .slice(0, 500);

  await sendTemplateToAdmin("clal_new_order", [
    order.orderId,
    `${order.customerName} | ${order.customerPhone}\nالمبلغ: ₪${order.total.toLocaleString()} | المصدر: ${order.source}`,
    itemsList,
    `${getPublicSiteUrl()}/crm/orders?search=${order.orderId}`,
  ]);
}

// ===== Order Completed Alert =====
// Template: clal_order_done  (3 params)
export async function notifyAdminOrderCompleted(order: {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  status: string;
}): Promise<void> {
  const customerLine = order.customerPhone
    ? `${order.customerName} | ${order.customerPhone}`
    : order.customerName;

  await sendTemplateToAdmin("clal_order_done", [
    `رقم الطلب: ${order.orderId}\nالزبون: ${customerLine}`,
    `₪${order.total.toLocaleString()} | ${order.status}`,
    `${getPublicSiteUrl()}/crm/orders?search=${order.orderId}`,
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
}): Promise<void> {
  const senderInfo = [contact.name, contact.phone, contact.email].filter(Boolean).join(" | ");
  const msgContent = contact.subject
    ? `الموضوع: ${contact.subject}\n${contact.message.slice(0, 400)}`
    : contact.message.slice(0, 450);

  await sendTemplateToAdmin("clal_contact_form", [
    senderInfo,
    msgContent,
    `${getPublicSiteUrl()}/crm/customers`,
  ]);
}

// ===== Muhammad Handoff Alert =====
// Template: clal_handoff  (3 params)
export async function notifyAdminMuhammadHandoff(details: {
  name: string;
  phone: string;
  message: string;
  channel: "webchat" | "whatsapp";
}): Promise<void> {
  const time = new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" });
  const channel = details.channel === "whatsapp" ? "واتساب" : "شات الموقع";

  await sendTemplateToAdmin("clal_handoff", [
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
}): Promise<void> {
  const time = new Date().toLocaleString("ar-EG", { timeZone: "Asia/Jerusalem" });
  const channel = details.channel === "whatsapp" ? "واتساب" : "شات الموقع";

  await sendTemplateToAdmin("clal_angry_cust", [
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
}): Promise<void> {
  const cacheKey = details.phone.replace(/[^0-9]/g, "");
  const lastNotified = _msgNotifyCache.get(cacheKey) || 0;

  if (Date.now() - lastNotified < MSG_NOTIFY_COOLDOWN) return;
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

  await sendTemplateToAdmin("clal_new_msg", [
    `${details.name || "مجهول"} (${details.phone})`,
    preview,
    `${time}\n${getPublicSiteUrl()}/crm/inbox`,
  ]);
}

// ===== Daily Report =====
// Template: clal_daily_report  (2 params)
export async function sendDailyReportLink(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await sendTemplateToAdmin("clal_daily_report", [
    today,
    `${getPublicSiteUrl()}/api/reports/daily?date=${today}`,
  ]);
}

// ===== Weekly Report =====
// Template: clal_weekly_report  (2 params)
export async function sendWeeklyReportLink(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await sendTemplateToAdmin("clal_weekly_report", [
    today,
    `${getPublicSiteUrl()}/api/reports/weekly?date=${today}`,
  ]);
}

// =====================================================
// Template definitions managed in lib/integrations/ycloud-templates.ts
// Use provisionRequiredTemplates() to create them on yCloud
// =====================================================
