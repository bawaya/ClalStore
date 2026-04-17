// =====================================================
// ClalMobile — Notification Service
// Sends WhatsApp notifications for order events
// Called from order API after create/status change
// =====================================================

import { sendWhatsAppText, sendWhatsAppTemplate } from "./whatsapp";
import { notifyAdmin, notifyTeam } from "./admin-notify";
import { buildOrderNotification, buildStatusNotification } from "./engine";

/** Send text to customer — fall back to template if 24h window expired */
async function sendToCustomer(
  phone: string,
  text: string,
  templateName?: string,
  templateParams?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await sendWhatsAppText(phone, text);
    return { success: true };
  } catch {
    // 24h window expired — try template
    if (templateName && templateParams) {
      try {
        await sendWhatsAppTemplate(phone, templateName, templateParams);
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Notification] Template ${templateName} also failed for ${phone}`);
        return { success: false, error: msg };
      }
    }
    return { success: false, error: "Text send failed and no template fallback" };
  }
}

// ===== New Order: Notify Team =====
export async function notifyNewOrder(
  orderId: string,
  customerName: string,
  customerPhone: string,
  total: number,
  source: string
) {
  try {
    // 1. Notify admin + team (from report phone)
    const teamMsg = buildOrderNotification(orderId, customerName, total, source);
    await notifyAdmin(teamMsg);
    await notifyTeam(teamMsg);

    // 2. Confirm to customer (with template fallback)
    const custMsg = `✅ *تم استلام طلبك!*\n\n📦 رقم الطلب: ${orderId}\n💰 المبلغ: ₪${total.toLocaleString()}\n\nالفريق سيتواصل معك قريباً.\nللاستفسار أرسل رقم طلبك في أي وقت.`;
    await sendToCustomer(customerPhone, custMsg, "clal_order_confirmation", [orderId, `₪${total.toLocaleString()}`]);
  } catch (err) {
    console.error("Notification error (new order):", err);
    // Don't throw — notification failure shouldn't block order
  }
}

// ===== Order Status Change: Notify Customer =====
const STATUS_AR: Record<string, string> = {
  approved: "تمت الموافقة ✅",
  processing: "قيد المعالجة ⚙️",
  shipped: "تم الشحن 🚚",
  delivered: "تم التوصيل 📦",
  cancelled: "تم الإلغاء ❌",
  rejected: "تم الرفض ⛔",
  returned: "تم الإرجاع 🔄",
};

export async function notifyStatusChange(
  orderId: string,
  customerPhone: string,
  newStatus: string
) {
  // Only notify on meaningful status changes (skip no_reply / new)
  const notifyStatuses = ["approved", "processing", "shipped", "delivered", "cancelled", "rejected", "returned"];
  if (!notifyStatuses.includes(newStatus)) return;

  try {
    const statusLabel = STATUS_AR[newStatus] || newStatus;
    const msg = buildStatusNotification(orderId, newStatus);
    await sendToCustomer(customerPhone, msg, "clal_order_status", [orderId, statusLabel]);
  } catch (err) {
    console.error("Notification error (status):", err);
  }
}

// ===== Reminder: No Reply =====
export async function sendNoReplyReminder(
  orderId: string,
  customerPhone: string,
  attempt: number
) {
  try {
    const msgs = [
      `📞 *${orderId}*\n\nحاولنا نتواصل معك بخصوص طلبك.\nالرجاء الرد هنا أو عبر فورم التواصل: clalmobile.com/contact 🙏`,
      `📞📞 *${orderId}*\n\nالمحاولة الثانية! طلبك بانتظار ردك.\nرد علينا هنا أو من الموقع: clalmobile.com/contact`,
      `⚠️ *${orderId}*\n\nالمحاولة الأخيرة! إذا ما رديت خلال 24 ساعة قد يُلغى الطلب.\n📝 clalmobile.com/contact`,
    ];

    const msg = msgs[Math.min(attempt - 1, 2)];
    await sendToCustomer(customerPhone, msg, "clal_reminder", [orderId]);
  } catch (err) {
    console.error("Notification error (no reply):", err);
  }
}
