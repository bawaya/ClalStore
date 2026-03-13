// =====================================================
// ClalMobile — Admin Notification Service
// Send WhatsApp alerts to admin for key events
//
// WHATSAPP_PHONE_ID    = +972533337653 (البوت — رسائل الزبائن)
// ADMIN_REPORT_PHONE   = +972537777963 (رقم التقارير — يرسل للأدمن)
// ADMIN_PERSONAL_PHONE = +972502404412 (رقم الأدمن — يستقبل التنبيهات)
// =====================================================

import { sendWhatsAppText, sendWhatsAppTemplate } from "./whatsapp";
import { getIntegrationConfig } from "@/lib/integrations/hub";

let _cachedCfg: Record<string, string> | null = null;
let _cachedAt = 0;
const CACHE_TTL = 60_000;

async function getWhatsAppCfg(): Promise<Record<string, string>> {
  if (_cachedCfg && Date.now() - _cachedAt < CACHE_TTL) return _cachedCfg;
  const cfg = await getIntegrationConfig("whatsapp");
  _cachedCfg = cfg as Record<string, string>;
  _cachedAt = Date.now();
  return _cachedCfg;
}

async function getReportPhone(): Promise<string> {
  const cfg = await getWhatsAppCfg();
  return cfg.reports_phone || process.env.ADMIN_REPORT_PHONE || "";
}

async function getAdminPhone(): Promise<string> {
  const cfg = await getWhatsAppCfg();
  return cfg.admin_phone || process.env.ADMIN_PERSONAL_PHONE || "";
}

async function getTeamNumbers(): Promise<string[]> {
  const cfg = await getWhatsAppCfg();
  const raw = cfg.team_numbers || process.env.TEAM_WHATSAPP_NUMBERS || "";
  return raw.split(",").map((n: string) => n.trim()).filter(Boolean);
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://clalmobile.com";

/** Send message to admin — from the report phone, try template first then text */
async function sendToAdmin(message: string): Promise<void> {
  const from = await getReportPhone();
  const to = await getAdminPhone();
  if (!to || !from) {
    console.error("[AdminNotify] SKIP — missing phone config:", !to ? "admin_phone" : "reports_phone");
    return;
  }

  const shortMsg = message.slice(0, 1024);

  // Strategy: try template FIRST (no 24h window needed), then text
  try {
    await sendWhatsAppTemplate(to, "clal_admin_alert", [shortMsg]);
    console.log("[AdminNotify] Template sent OK from", from, "to", to);
    return;
  } catch (templateErr: any) {
    console.warn("[AdminNotify] Template failed:", templateErr?.message || templateErr);
  }

  // Fallback: free-form text from report phone (only works within 24h window)
  try {
    await sendWhatsAppText(to, message, from);
    console.log("[AdminNotify] Text sent OK from", from, "to", to);
  } catch (textErr: any) {
    console.error("[AdminNotify] Both template and text failed —", textErr?.message || textErr);
  }
}

export async function notifyAdmin(message: string): Promise<void> {
  await sendToAdmin(message);
}

export async function notifyAdminPersonal(message: string): Promise<void> {
  await sendToAdmin(message);
}

export async function notifyTeam(message: string): Promise<void> {
  const from = await getReportPhone();
  const numbers = await getTeamNumbers();
  if (numbers.length === 0) return;
  const shortMsg = message.slice(0, 1024);
  for (const num of numbers) {
    try {
      await sendWhatsAppTemplate(num.trim(), "clal_admin_alert", [shortMsg]);
    } catch {
      try {
        await sendWhatsAppText(num.trim(), message, from);
      } catch (err) {
        console.error(`[AdminNotify] Team notify failed (${num}):`, err);
      }
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
