// =====================================================
// ClalMobile — Notification Service
// Sends WhatsApp notifications for order events
// Called from order API after create/status change
// =====================================================

import { sendWhatsAppText, sendWhatsAppTemplate } from "./whatsapp";
import { notifyAdmin, notifyTeam } from "./admin-notify";
import { buildOrderNotification, buildStatusNotification } from "./engine";

/** Send text to customer — fall back to template if 24h window expired */
async function sendToCustomer(phone: string, text: string, templateName?: string, templateParams?: string[]): Promise<boolean> {
  try {
    await sendWhatsAppText(phone, text);
    return true;
  } catch {
    // 24h window expired — try template
    if (templateName && templateParams) {
      try {
        await sendWhatsAppTemplate(phone, templateName, templateParams);
        return true;
      } catch {
        console.error(`[Notification] Template ${templateName} also failed for ${phone}`);
      }
    }
  }
  return false;
}

// ===== New Order: Notify Team =====
export async function notifyNewOrder(
  orderId: string,
  customerName: string,
  customerPhone: string,
  total: number,
  source: string,
  customerCode?: string | null
): Promise<{ sent: boolean }> {
  try {
    // 1. Notify admin + team (from report phone)
    const teamMsg = buildOrderNotification(orderId, customerName, total, source);
    await notifyAdmin(teamMsg);
    await notifyTeam(teamMsg);

    // 2. Confirm to customer (with template fallback)
    const codeLine = customerCode ? `\n🎖️ كود الزبون: *${customerCode}*  (احتفظ فيه لطلباتك القادمة)` : "";
    const custMsg = `✅ *تم استلام طلبك!*\n\n📦 رقم الطلب: ${orderId}\n💰 المبلغ: ₪${total.toLocaleString()}${codeLine}\n\nالفريق سيتواصل معك قريباً.\nللاستفسار أرسل رقم طلبك في أي وقت.`;
    const custSent = await sendToCustomer(customerPhone, custMsg, "clal_order_confirmation", [orderId, `₪${total.toLocaleString()}`]);
    return { sent: custSent };
  } catch (err) {
    console.error("Notification error (new order):", err);
    return { sent: false };
  }
}

// ===== Order Status Change: Notify Customer =====
export async function notifyStatusChange(
  orderId: string,
  customerPhone: string,
  newStatus: string
): Promise<{ sent: boolean }> {
  // Only notify on meaningful status changes
  const notifyStatuses = ["approved", "processing", "shipped", "delivered", "cancelled", "returned", "rejected"];
  if (!notifyStatuses.includes(newStatus)) return { sent: false };

  try {
    const msg = buildStatusNotification(orderId, newStatus);
    const sent = await sendToCustomer(customerPhone, msg, "clal_order_status", [orderId, newStatus]);
    return { sent };
  } catch (err) {
    console.error("Notification error (status):", err);
    return { sent: false };
  }
}

// ===== Reminder: No Reply =====
export async function sendNoReplyReminder(
  orderId: string,
  customerPhone: string,
  attempt: number
): Promise<{ sent: boolean }> {
  try {
    const msgs = [
      `📞 *${orderId}*\n\nحاولنا نتواصل معك بخصوص طلبك.\nالرجاء الرد هنا أو عبر فورم التواصل: clalmobile.com/contact 🙏`,
      `📞📞 *${orderId}*\n\nالمحاولة الثانية! طلبك بانتظار ردك.\nرد علينا هنا أو من الموقع: clalmobile.com/contact`,
      `⚠️ *${orderId}*\n\nالمحاولة الأخيرة! إذا ما رديت خلال 24 ساعة قد يُلغى الطلب.\n📝 clalmobile.com/contact`,
    ];

    const msg = msgs[Math.min(attempt - 1, 2)];
    const sent = await sendToCustomer(customerPhone, msg, "clal_reminder", [orderId]);
    return { sent };
  } catch (err) {
    console.error("Notification error (no reply):", err);
    return { sent: false };
  }
}
