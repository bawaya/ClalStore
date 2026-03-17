// =====================================================
// ClalMobile — Email Templates
// Reusable HTML email templates for customer notifications
// =====================================================

const BRAND_COLOR = "#c41040";
const BG_COLOR = "#f9fafb";
const CARD_BG = "#ffffff";

// Status icons and labels
const STATUS_MAP: Record<string, { icon: string; label_ar: string; label_he: string; color: string }> = {
  confirmed:  { icon: "✅", label_ar: "تم تأكيد الطلب",    label_he: "ההזמנה אושרה",       color: "#059669" },
  processing: { icon: "⚙️", label_ar: "قيد التجهيز",       label_he: "בהכנה",              color: "#d97706" },
  shipped:    { icon: "🚚", label_ar: "بالطريق إليك!",     label_he: "בדרך אליך!",         color: "#2563eb" },
  delivered:  { icon: "📦", label_ar: "تم التوصيل بنجاح",  label_he: "נמסר בהצלחה",        color: "#059669" },
  cancelled:  { icon: "❌", label_ar: "تم إلغاء الطلب",    label_he: "ההזמנה בוטלה",        color: "#ef4444" },
};

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ClalMobile</title>
</head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_COLOR}">
<tr><td align="center" style="padding:24px 16px">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${CARD_BG};border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,${BRAND_COLOR},#8b0a2e);padding:28px 24px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:1px">ClalMobile</h1>
<p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:12px">وكيل رسمي لـ HOT Mobile</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:0">
${content}
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
<p style="margin:0 0 4px;font-size:12px;color:#6b7280">ClalMobile — وكيل رسمي لـ HOT Mobile</p>
<p style="margin:0 0 4px;font-size:12px;color:#6b7280">📞 053-3337653 &nbsp; | &nbsp; 💬 <a href="https://wa.me/972533337653" style="color:${BRAND_COLOR}">واتساب</a> &nbsp; | &nbsp; 📧 info@clalmobile.com</p>
<p style="margin:8px 0 0;font-size:10px;color:#9ca3af">
<a href="https://clalmobile.com/privacy" style="color:#9ca3af">سياسة الخصوصية</a> &nbsp;|&nbsp;
<a href="https://clalmobile.com/legal" style="color:#9ca3af">الشروط والأحكام</a>
</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ===== Order Confirmation Email =====
export function orderConfirmationEmail(
  orderId: string,
  customerName: string,
  total: number,
  items: { name: string; qty: number; price: number }[],
  paymentMethod?: string,
  shippingCity?: string,
  shippingAddress?: string,
): { subject: string; html: string } {
  const itemRows = items.map((i) =>
    `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;color:#374151">${i.name}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:13px;color:#6b7280">${i.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:left;font-size:13px;font-weight:700;color:#374151">₪${(i.price * i.qty).toLocaleString()}</td>
    </tr>`
  ).join("");

  const paymentLabel = paymentMethod === "bank" ? "تحويل بنكي" : paymentMethod === "credit" ? "بطاقة ائتمان" : paymentMethod || "";

  const content = `
<div style="padding:28px 24px">
  <h2 style="color:#111;margin:0 0 6px;font-size:20px;text-align:right">مرحباً ${customerName}! 🎉</h2>
  <p style="color:#6b7280;margin:0 0 20px;font-size:14px;text-align:right">تم استلام طلبك بنجاح وسنتواصل معك قريباً لتأكيد التفاصيل.</p>
  
  <!-- Order ID -->
  <div style="background:#fef2f2;border:1px solid rgba(196,16,64,0.15);border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:right">
    <span style="font-size:12px;color:#6b7280">رقم الطلب:</span>
    <span style="font-size:18px;font-weight:800;color:${BRAND_COLOR};margin-right:8px">${orderId}</span>
  </div>
  
  <!-- Items Table -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px">
    <thead>
      <tr style="background:#f9fafb">
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">المنتج</th>
        <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600">الكمية</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">السعر</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr style="background:#f9fafb">
        <td colspan="2" style="padding:12px;text-align:right;font-weight:700;font-size:14px;color:#111">المجموع الكلي</td>
        <td style="padding:12px;text-align:left;font-weight:800;font-size:18px;color:${BRAND_COLOR}">₪${total.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>
  
  ${paymentLabel || shippingCity || shippingAddress ? `
  <!-- Order Details -->
  <div style="background:#f9fafb;border-radius:10px;padding:14px 18px;margin-bottom:20px">
    ${paymentLabel ? `<p style="margin:0 0 6px;font-size:13px;color:#374151"><strong>طريقة الدفع:</strong> ${paymentLabel}</p>` : ""}
    ${shippingCity ? `<p style="margin:0 0 6px;font-size:13px;color:#374151"><strong>المدينة:</strong> ${shippingCity}</p>` : ""}
    ${shippingAddress ? `<p style="margin:0;font-size:13px;color:#374151"><strong>العنوان:</strong> ${shippingAddress}</p>` : ""}
  </div>
  ` : ""}
  
  <!-- Info -->
  <div style="text-align:right">
    <p style="font-size:13px;color:#6b7280;margin:0 0 4px">🚚 التوصيل خلال 1-2 يوم عمل لكل أنحاء إسرائيل.</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">📱 سنتواصل معك قريباً عبر WhatsApp لتأكيد التفاصيل.</p>
  </div>
  
  <!-- CTA -->
  <div style="text-align:center;margin-top:24px">
    <a href="https://clalmobile.com/store" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">تابع التسوّق 🛒</a>
  </div>
</div>`;

  return {
    subject: `✅ تأكيد طلبك ${orderId} — ClalMobile`,
    html: emailWrapper(content),
  };
}

// ===== Order Status Update Email =====
export function orderStatusEmail(
  orderId: string,
  customerName: string,
  status: string,
): { subject: string; html: string } {
  const info = STATUS_MAP[status] || { icon: "📋", label_ar: status, label_he: status, color: "#6b7280" };

  const content = `
<div style="padding:28px 24px;text-align:right">
  <h2 style="color:#111;margin:0 0 6px;font-size:20px">مرحباً ${customerName}</h2>
  <p style="color:#6b7280;margin:0 0 20px;font-size:14px">تم تحديث حالة طلبك:</p>
  
  <!-- Order ID -->
  <div style="background:#fef2f2;border:1px solid rgba(196,16,64,0.15);border-radius:10px;padding:12px 18px;margin-bottom:20px">
    <span style="font-size:12px;color:#6b7280">رقم الطلب:</span>
    <span style="font-size:16px;font-weight:800;color:${BRAND_COLOR};margin-right:8px">${orderId}</span>
  </div>
  
  <!-- Status Badge -->
  <div style="background:${info.color}10;border:2px solid ${info.color}30;border-radius:14px;padding:20px;margin-bottom:20px;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">${info.icon}</div>
    <div style="font-size:18px;font-weight:800;color:${info.color}">${info.label_ar}</div>
  </div>
  
  ${status === "shipped" ? `
  <p style="font-size:13px;color:#374151;margin:0 0 4px">🚚 طلبك في الطريق! التوصيل المتوقع خلال 1-2 يوم عمل.</p>
  ` : ""}
  
  ${status === "delivered" ? `
  <p style="font-size:13px;color:#374151;margin:0 0 4px">📦 شكراً لتسوقك من ClalMobile! نتمنى أن ينال المنتج رضاك.</p>
  <p style="font-size:13px;color:#6b7280;margin:0 0 4px">إذا عندك أي استفسار، لا تتردد بالتواصل معنا.</p>
  ` : ""}
  
  ${status === "cancelled" ? `
  <p style="font-size:13px;color:#374151;margin:0 0 4px">إذا كان الإلغاء بالخطأ أو تحتاج مساعدة، تواصل معنا فوراً.</p>
  ` : ""}
  
  <!-- Contact -->
  <div style="margin-top:20px;padding:14px 18px;background:#f9fafb;border-radius:10px">
    <p style="margin:0;font-size:12px;color:#6b7280">للاستفسار تواصل معنا:</p>
    <p style="margin:4px 0 0;font-size:13px;color:#374151">📞 053-3337653 &nbsp; | &nbsp; 💬 <a href="https://wa.me/972533337653" style="color:${BRAND_COLOR}">واتساب</a></p>
  </div>
</div>`;

  const subjectIcon = info.icon;
  return {
    subject: `${subjectIcon} تحديث طلبك ${orderId} — ${info.label_ar}`,
    html: emailWrapper(content),
  };
}
