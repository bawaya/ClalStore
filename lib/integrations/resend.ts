// =====================================================
// ClalMobile — Resend Email Provider
// Modern transactional email API (resend.com)
// Free tier: 100 emails/day, 3000/month
// =====================================================

import type { EmailProvider, EmailParams, EmailResult } from "./hub";
import { getIntegrationConfig } from "./hub";

const RESEND_API = "https://api.resend.com";

/** Read Resend credentials — DB first, env fallback */
async function getResendConfig() {
  const dbCfg = await getIntegrationConfig("email");
  const apiKey = dbCfg.api_key || process.env.RESEND_API_KEY || "";
  const fromEmail = dbCfg.from_email || process.env.RESEND_FROM || "ClalMobile <noreply@clalmobile.com>";
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  return { apiKey, fromEmail };
}

export class ResendProvider implements EmailProvider {
  name = "Resend";

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const { apiKey, fromEmail } = await getResendConfig();

      const res = await fetch(`${RESEND_API}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: params.from || fromEmail,
          to: [params.to],
          subject: params.subject,
          html: params.html || undefined,
          text: params.text || undefined,
          reply_to: params.replyTo || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Resend error ${res.status}`,
        };
      }

      const data = await res.json();
      return { success: true, messageId: data.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async sendTemplate(
    _templateId: string,
    to: string,
    data: Record<string, string>
  ): Promise<EmailResult> {
    // Resend doesn't have built-in templates — we use inline HTML
    // templateId can be used as a key to select a template builder
    const subject = data.subject || "ClalMobile";
    const html = data.html || `<p>${JSON.stringify(data)}</p>`;
    return this.send({ to, subject, html });
  }
}

// ===== Email Templates (inline HTML — same as SendGrid) =====

export function buildOrderConfirmEmail(
  orderId: string,
  customerName: string,
  total: number,
  items: { name: string; qty: number; price: number }[]
): EmailParams {
  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.name} × ${i.qty}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:left">₪${i.price.toLocaleString()}</td></tr>`
    )
    .join("");

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
          <p>📞 053-3337653 | 📧 info@clalmobile.com</p>
        </div>
      </div>
    `,
  };
}

export function buildStatusUpdateEmail(
  orderId: string,
  customerName: string,
  status: string,
  statusLabel: string
): EmailParams {
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
          <p style="color:#999;font-size:12px">للاستفسار تواصل معنا عبر واتساب أو اتصل بـ 053-3337653</p>
        </div>
      </div>
    `,
  };
}

export function buildWelcomeEmail(customerName: string): EmailParams {
  return {
    to: "",
    subject: `مرحباً بك في ClalMobile! 🎉`,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#c41040,#8b0a2e);padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">ClalMobile</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:12px">وكيل رسمي لـ HOT Mobile</p>
        </div>
        <div style="padding:24px;text-align:right">
          <h2 style="color:#333">مرحباً ${customerName}! 🎉</h2>
          <p style="color:#666">شكراً لانضمامك إلى عائلة ClalMobile. نحن هنا لخدمتك بأفضل الأجهزة وباقات الاتصال.</p>
          <div style="text-align:center;margin-top:20px">
            <a href="https://clalmobile.com/store" style="background:#c41040;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold">تسوّق الآن</a>
          </div>
        </div>
        <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999">
          <p>📞 053-3337653 | 📧 info@clalmobile.com</p>
        </div>
      </div>
    `,
  };
}

export function buildContactFormEmail(
  name: string,
  email: string,
  phone: string,
  message: string
): EmailParams {
  return {
    to: "info@clalmobile.com",
    subject: `📩 رسالة جديدة من ${name} — نموذج التواصل`,
    replyTo: email,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#c41040,#8b0a2e);padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:20px">📩 رسالة جديدة</h1>
        </div>
        <div style="padding:24px;text-align:right">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;font-weight:bold;color:#333;border-bottom:1px solid #eee">الاسم</td><td style="padding:8px;color:#666;border-bottom:1px solid #eee">${name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#333;border-bottom:1px solid #eee">الإيميل</td><td style="padding:8px;color:#666;border-bottom:1px solid #eee">${email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#333;border-bottom:1px solid #eee">الهاتف</td><td style="padding:8px;color:#666;border-bottom:1px solid #eee">${phone}</td></tr>
          </table>
          <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-top:16px">
            <p style="color:#333;margin:0;white-space:pre-wrap">${message}</p>
          </div>
        </div>
      </div>
    `,
  };
}
