// =====================================================
// ClalMobile — SendGrid Email Provider
// Transactional emails: order confirm, status, welcome
// =====================================================

import type { EmailProvider, EmailParams, EmailResult } from "./hub";
import { getIntegrationConfig } from "./hub";

const SENDGRID_API = "https://api.sendgrid.com/v3";

/** Read SendGrid credentials — DB first, env fallback */
async function getSendGridConfig() {
  const dbCfg = await getIntegrationConfig("email");
  const apiKey = dbCfg.api_key || process.env.SENDGRID_API_KEY || "";
  const fromEmail = dbCfg.from_email || process.env.SENDGRID_FROM || "noreply@clalmobile.com";
  if (!apiKey) throw new Error("SENDGRID_API_KEY not set");
  return { apiKey, fromEmail };
}

export class SendGridProvider implements EmailProvider {
  name = "SendGrid";

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const { apiKey, fromEmail } = await getSendGridConfig();
      const res = await fetch(`${SENDGRID_API}/mail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.from || fromEmail, name: "ClalMobile" },
          reply_to: params.replyTo ? { email: params.replyTo } : undefined,
          subject: params.subject,
          content: [
            params.html ? { type: "text/html", value: params.html } : { type: "text/plain", value: params.text || "" },
          ],
        }),
      });

      return { success: res.ok, messageId: res.headers.get("x-message-id") || undefined };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async sendTemplate(templateId: string, to: string, data: Record<string, string>): Promise<EmailResult> {
    try {
      const { apiKey, fromEmail } = await getSendGridConfig();
      const res = await fetch(`${SENDGRID_API}/mail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }], dynamic_template_data: data }],
          from: { email: fromEmail, name: "ClalMobile" },
          template_id: templateId,
        }),
      });

      return { success: res.ok, messageId: res.headers.get("x-message-id") || undefined };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// ===== Email Templates (inline HTML) =====
export function buildOrderConfirmEmail(orderId: string, customerName: string, total: number, items: { name: string; qty: number; price: number }[]): EmailParams {
  const itemRows = items.map((i) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.name} × ${i.qty}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:left">₪${i.price.toLocaleString()}</td></tr>`
  ).join("");

  return {
    to: "",
    subject: `✅ تأكيد طلبك ${orderId} — ClalMobile`,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#c41040,#8b0a2e);padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">ClalMobile</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:12px">وكيل رسمي لـ HOT Mobile</p>
        </div>
        <div style="padding:24px">
          <h2 style="color:#333;text-align:right">مرحباً ${customerName}! ✅</h2>
          <p style="color:#666;text-align:right">تم استلام طلبك بنجاح. رقم الطلب: <strong style="color:#c41040">${orderId}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:right">المنتج</th><th style="padding:8px;text-align:left">السعر</th></tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot><tr style="background:#f8f8f8"><td style="padding:12px;font-weight:bold;text-align:right">المجموع</td><td style="padding:12px;font-weight:bold;color:#c41040;text-align:left;font-size:18px">₪${total.toLocaleString()}</td></tr></tfoot>
          </table>
          <p style="color:#666;text-align:right;font-size:13px">🚚 التوصيل خلال 1-2 يوم عمل. سنتواصل معك قريباً لتأكيد التفاصيل.</p>
          <div style="text-align:center;margin-top:20px">
            <a href="https://clalmobile.com/store" style="background:#c41040;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold">تابع التسوّق</a>
          </div>
        </div>
        <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999">
          <p>ClalMobile — وكيل رسمي لـ HOT Mobile</p>
          <p>📞 054-9414448 | 📧 info@clalmobile.com</p>
        </div>
      </div>
    `,
  };
}

export function buildStatusUpdateEmail(orderId: string, customerName: string, status: string, statusLabel: string): EmailParams {
  return {
    to: "",
    subject: `📦 تحديث طلبك ${orderId} — ${statusLabel}`,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#c41040,#8b0a2e);padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:20px">ClalMobile</h1>
        </div>
        <div style="padding:24px;text-align:right">
          <h2 style="color:#333">مرحباً ${customerName}</h2>
          <p style="color:#666">تم تحديث حالة طلبك <strong style="color:#c41040">${orderId}</strong>:</p>
          <div style="background:#f0f0f0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;font-size:18px">
            ${statusLabel}
          </div>
          <p style="color:#999;font-size:12px">للاستفسار تواصل معنا عبر واتساب أو اتصل بـ 054-9414448</p>
        </div>
      </div>
    `,
  };
}
