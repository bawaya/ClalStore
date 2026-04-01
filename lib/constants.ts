// =====================================================
// ClalMobile — Constants
// =====================================================

export const BUSINESS = {
  name: "ClalMobile",
  name_ar: "كلال موبايل",
  name_he: "כלל מובייל",
  phone: "053-3337653",
  phoneRaw: "972533337653",
  email: "info@clalmobile.com",
  whatsapp: "https://wa.me/972533337653",
  address_ar: "إسرائيل",
  address_he: "ישראל",
  workingHours: {
    days_ar: "أحد - خميس",
    days_he: "ראשון - חמישי",
    hours: "9:00 - 18:00",
  },
  url: "https://clalmobile.com",
} as const;

export const ORDER_STATUS = {
  new: { label: "جديد", labelHe: "חדש", color: "#3b82f6", icon: "🆕" },
  approved: { label: "موافق", labelHe: "מאושר", color: "#22c55e", icon: "✅" },
  processing: { label: "قيد التجهيز", labelHe: "בהכנה", color: "#eab308", icon: "⚙️" },
  shipped: { label: "قيد الشحن", labelHe: "בדרך", color: "#a855f7", icon: "🚚" },
  delivered: { label: "تم التسليم", labelHe: "נמסר", color: "#06b6d4", icon: "📦" },
  cancelled: { label: "ملغي", labelHe: "בוטל", color: "#71717a", icon: "🚫" },
  rejected: { label: "مرفوض", labelHe: "נדחה", color: "#ef4444", icon: "❌" },
  returned: { label: "مرتجع", labelHe: "הוחזר", color: "#78716c", icon: "↩️" },
  no_reply_1: { label: "لا يوجد رد 1", labelHe: "אין מענה 1", color: "#f97316", icon: "📞" },
  no_reply_2: { label: "لا يوجد رد 2", labelHe: "אין מענה 2", color: "#f97316", icon: "📞📞" },
  no_reply_3: { label: "لا يوجد رد 3", labelHe: "אין מענה 3", color: "#ef4444", icon: "📞📞📞" },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export const ORDER_SOURCE = {
  store: { label: "المتجر", labelHe: "חנות", color: "#3b82f6", icon: "🛒" },
  facebook: { label: "فيسبوك", labelHe: "פייסבוק", color: "#1877f2", icon: "📘" },
  external: { label: "متجر خارجي", labelHe: "חנות חיצונית", color: "#f97316", icon: "🏪" },
  whatsapp: { label: "واتساب", labelHe: "וואטסאפ", color: "#25d366", icon: "💬" },
  webchat: { label: "شات الموقع", labelHe: "צ'אט", color: "#a855f7", icon: "🌐" },
  manual: { label: "يدوي", labelHe: "ידני", color: "#71717a", icon: "✍️" },
} as const;

export type OrderSource = keyof typeof ORDER_SOURCE;

export const USER_ROLE = {
  super_admin: { label: "مدير عام", labelHe: "מנהל ראשי", color: "#c41040", icon: "👑", permissions: ["*"] },
  admin: { label: "مدير", labelHe: "מנהל", color: "#a855f7", icon: "🔑", permissions: ["products", "orders", "customers", "tasks", "pipeline", "coupons", "heroes", "lines", "emails", "settings"] },
  sales: { label: "مبيعات", labelHe: "מכירות", color: "#3b82f6", icon: "💼", permissions: ["orders", "customers", "tasks", "pipeline"] },
  support: { label: "دعم", labelHe: "תמיכה", color: "#22c55e", icon: "🎧", permissions: ["orders", "customers", "tasks"] },
  content: { label: "محتوى", labelHe: "תוכן", color: "#f97316", icon: "✏️", permissions: ["products", "heroes", "emails"] },
  viewer: { label: "مشاهد", labelHe: "צופה", color: "#3f3f46", icon: "👁️", permissions: ["orders.read", "customers.read"] },
} as const;

export type UserRole = keyof typeof USER_ROLE;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],
  admin: ["products", "orders", "customers", "tasks", "pipeline", "coupons", "heroes", "lines", "emails", "settings"],
  sales: ["orders", "customers", "tasks", "pipeline"],
  support: ["orders", "customers", "tasks"],
  content: ["products", "heroes", "emails"],
  viewer: ["orders.read", "customers.read"],
};

export const CUSTOMER_SEGMENT = {
  vip: { label: "VIP", labelHe: "VIP", color: "#c41040", icon: "🏆" },
  loyal: { label: "مخلص", labelHe: "נאמן", color: "#eab308", icon: "⭐" },
  active: { label: "نشط", labelHe: "פעיל", color: "#22c55e", icon: "🟢" },
  new: { label: "جديد", labelHe: "חדש", color: "#3b82f6", icon: "🆕" },
  cold: { label: "بارد", labelHe: "קר", color: "#f97316", icon: "🟡" },
  lost: { label: "مفقود", labelHe: "אבוד", color: "#ef4444", icon: "🔴" },
  inactive: { label: "غير نشط", labelHe: "לא פעיל", color: "#71717a", icon: "⏸️" },
} as const;

export const PIPELINE_STAGE = {
  lead: { label: "عميل محتمل", labelHe: "ליד", color: "#3b82f6", icon: "🎯" },
  negotiation: { label: "تفاوض", labelHe: "משא ומתן", color: "#eab308", icon: "💬" },
  proposal: { label: "عرض سعر", labelHe: "הצעת מחיר", color: "#a855f7", icon: "📋" },
  won: { label: "تم البيع", labelHe: "נסגר", color: "#22c55e", icon: "🏆" },
  lost: { label: "خسارة", labelHe: "הפסד", color: "#ef4444", icon: "❌" },
} as const;

export const TASK_PRIORITY = {
  high: { label: "عاجل", labelHe: "דחוף", color: "#ef4444", icon: "🔴" },
  medium: { label: "متوسط", labelHe: "בינוני", color: "#eab308", icon: "🟡" },
  low: { label: "عادي", labelHe: "רגיל", color: "#22c55e", icon: "🟢" },
} as const;

export const BANKS = [
  { id: "hapoalim", name_ar: "بنك هبوعليم", name_he: "בנק הפועלים", code: "12" },
  { id: "leumi", name_ar: "بنك لئومي", name_he: "בנק לאומי", code: "10" },
  { id: "discount", name_ar: "بنك ديسكونت", name_he: "בנק דיסקונט", code: "11" },
  { id: "mizrahi", name_ar: "بنك مزراحي طفحوت", name_he: "בנק מזרחי טפחות", code: "20" },
  { id: "benleumi", name_ar: "البنك الدولي الأول", name_he: "הבינלאומי", code: "31" },
  { id: "one_zero", name_ar: "وان زيرو", name_he: "One Zero", code: "18" },
  { id: "yahav", name_ar: "بنك يهاف", name_he: "בנק יהב", code: "04" },
  { id: "mercantile", name_ar: "بنك مركنتيل", name_he: "מרקנטיל", code: "17" },
  { id: "otsar", name_ar: "بنك أوتسار هحيال", name_he: "אוצר החייל", code: "14" },
  { id: "union", name_ar: "بنك الاتحاد", name_he: "בנק איגוד", code: "13" },
  { id: "masad", name_ar: "بنك مساد", name_he: "בנק מסד", code: "46" },
  { id: "jerusalem", name_ar: "بنك القدس", name_he: "בנק ירושלים", code: "54" },
  { id: "poalei_agudat", name_ar: "بنك بوعلي أغودات", name_he: "בנק פועלי אגודת ישראל", code: "52" },
  { id: "dexia", name_ar: "بنك دكسيا", name_he: "דקסיה", code: "68" },
  { id: "arab_israeli", name_ar: "البنك العربي الإسرائيلي", name_he: "הבנק הערבי הישראלי", code: "34" },
] as const;

export const INTEGRATION_TYPES = {
  whatsapp: { label: "WhatsApp", icon: "💬", providers: ["yCloud", "Meta API", "Twilio"] as readonly string[] },
  sms: { label: "SMS / OTP", icon: "📱", providers: ["Twilio SMS"] as readonly string[] },
  payment: { label: "الدفع — إسرائيل", icon: "💳", providers: ["רווחית (Rivhit)", "Tranzila", "PayPlus", "Stripe"] as readonly string[] },
  payment_upay: { label: "الدفع — فلسطين والعالم", icon: "💳", providers: ["UPay"] as readonly string[] },
  email: { label: "Email", icon: "📧", providers: ["Resend", "SendGrid", "Mailgun", "Amazon SES", "SMTP"] as readonly string[] },
  ai_chat: { label: "ذكاء اصطناعي (بوت + بحث)", icon: "🤖", providers: ["Anthropic Claude"] as readonly string[] },
  ai_admin: { label: "ذكاء اصطناعي (أدمن)", icon: "🧠", providers: ["OpenAI"] as readonly string[] },
  storage: { label: "تخزين الصور", icon: "☁️", providers: ["Cloudflare R2"] as readonly string[] },
  image_processing: { label: "معالجة الصور", icon: "🖼️", providers: ["RemoveBG"] as readonly string[] },
  device_specs: { label: "مواصفات الأجهزة", icon: "📋", providers: ["MobileAPI"] as readonly string[] },
  image_search: { label: "بحث صور المنتجات", icon: "🔍", providers: ["Pexels"] as readonly string[] },
  push_notifications: { label: "إشعارات Push", icon: "🔔", providers: ["Web Push (VAPID)"] as readonly string[] },
  analytics: { label: "Analytics", icon: "📊", providers: ["Google Analytics", "Mixpanel"] as readonly string[] },
  crm_external: { label: "CRM خارجي", icon: "🔄", providers: ["HubSpot", "Salesforce"] as readonly string[] },
} as const;

export const PRODUCT_TYPES = {
  device: { label: "جهاز", labelHe: "מכשיר", icon: "📱" },
  accessory: { label: "إكسسوار", labelHe: "אביזר", icon: "🔌" },
} as const;
