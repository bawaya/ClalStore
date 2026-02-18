// =====================================================
// ClalMobile — Constants
// All shared constants across Store/Admin/CRM
// =====================================================

// ===== Order Statuses (8 statuses + 3 no-reply) =====
export const ORDER_STATUS = {
  new:        { label: "جديد",         labelHe: "חדש",         color: "#3b82f6", icon: "🆕" },
  approved:   { label: "موافق",        labelHe: "מאושר",      color: "#22c55e", icon: "✅" },
  shipped:    { label: "قيد الشحن",    labelHe: "בדרך",       color: "#a855f7", icon: "🚚" },
  delivered:  { label: "تم التسليم",   labelHe: "נמסר",       color: "#06b6d4", icon: "📦" },
  rejected:   { label: "مرفوض",        labelHe: "נדחה",       color: "#ef4444", icon: "❌" },
  no_reply_1: { label: "لا يوجد رد 1", labelHe: "אין מענה 1", color: "#f97316", icon: "📞" },
  no_reply_2: { label: "لا يوجد رد 2", labelHe: "אין מענה 2", color: "#f97316", icon: "📞📞" },
  no_reply_3: { label: "لا يوجد رد 3", labelHe: "אין מענה 3", color: "#ef4444", icon: "📞📞📞" },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

// ===== Order Sources =====
export const ORDER_SOURCE = {
  store:    { label: "المتجر",       labelHe: "חנות",        color: "#3b82f6", icon: "🛒" },
  facebook: { label: "فيسبوك",       labelHe: "פייסבוק",    color: "#1877f2", icon: "📘" },
  external: { label: "متجر خارجي",   labelHe: "חנות חיצונית", color: "#f97316", icon: "🏪" },
  whatsapp: { label: "واتساب",       labelHe: "וואטסאפ",    color: "#25d366", icon: "💬" },
  webchat:  { label: "شات الموقع",   labelHe: "צ'אט",       color: "#a855f7", icon: "🌐" },
  manual:   { label: "يدوي",         labelHe: "ידני",       color: "#71717a", icon: "✍️" },
} as const;

export type OrderSource = keyof typeof ORDER_SOURCE;

// ===== User Roles =====
export const USER_ROLE = {
  super_admin: { label: "مدير عام",  labelHe: "מנהל ראשי", color: "#c41040", icon: "👑", permissions: ["*"] },
  admin:       { label: "مدير",      labelHe: "מנהל",      color: "#a855f7", icon: "🔑", permissions: ["products", "orders", "customers", "tasks", "pipeline", "coupons", "heroes", "lines", "emails", "settings"] },
  sales:       { label: "مبيعات",    labelHe: "מכירות",    color: "#3b82f6", icon: "💼", permissions: ["orders", "customers", "tasks", "pipeline"] },
  support:     { label: "دعم",       labelHe: "תמיכה",     color: "#22c55e", icon: "🎧", permissions: ["orders", "customers", "tasks"] },
  content:     { label: "محتوى",     labelHe: "תוכן",      color: "#f97316", icon: "✏️", permissions: ["products", "heroes", "emails"] },
  viewer:      { label: "مشاهد",     labelHe: "צופה",      color: "#3f3f46", icon: "👁️", permissions: ["orders.read", "customers.read"] },
} as const;

export type UserRole = keyof typeof USER_ROLE;

// Role permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],
  admin:       ["products", "orders", "customers", "tasks", "pipeline", "coupons", "heroes", "lines", "emails", "settings"],
  sales:       ["orders", "customers", "tasks", "pipeline"],
  support:     ["orders", "customers", "tasks"],
  content:     ["products", "heroes", "emails"],
  viewer:      ["orders.read", "customers.read"],
};

// ===== Customer Segments (RFM) =====
export const CUSTOMER_SEGMENT = {
  vip:    { label: "VIP",    labelHe: "VIP",    color: "#c41040", icon: "🏆" },
  loyal:  { label: "مخلص",   labelHe: "נאמן",   color: "#eab308", icon: "⭐" },
  active: { label: "نشط",    labelHe: "פעיל",   color: "#22c55e", icon: "🟢" },
  new:    { label: "جديد",   labelHe: "חדש",    color: "#3b82f6", icon: "🆕" },
  cold:   { label: "بارد",   labelHe: "קר",     color: "#f97316", icon: "🟡" },
  lost:   { label: "مفقود",  labelHe: "אבוד",   color: "#ef4444", icon: "🔴" },
} as const;

export type CustomerSegment = keyof typeof CUSTOMER_SEGMENT;

// ===== Pipeline Stages =====
export const PIPELINE_STAGE = {
  lead:        { label: "عميل محتمل", labelHe: "ליד",     color: "#3b82f6", icon: "🎯" },
  negotiation: { label: "تفاوض",     labelHe: "משא ומתן", color: "#eab308", icon: "💬" },
  proposal:    { label: "عرض سعر",   labelHe: "הצעת מחיר", color: "#a855f7", icon: "📋" },
  won:         { label: "تم البيع",   labelHe: "נסגר",     color: "#22c55e", icon: "🏆" },
  lost:        { label: "خسارة",     labelHe: "הפסד",     color: "#ef4444", icon: "❌" },
} as const;

// ===== Task Priority =====
export const TASK_PRIORITY = {
  high:   { label: "عاجل",  labelHe: "דחוף",  color: "#ef4444", icon: "🔴" },
  medium: { label: "متوسط", labelHe: "בינוני", color: "#eab308", icon: "🟡" },
  low:    { label: "عادي",  labelHe: "רגיל",  color: "#22c55e", icon: "🟢" },
} as const;

// ===== Banks (without Israel Post Bank) =====
export const BANKS = [
  { id: "hapoalim", name_ar: "بنك هبوعليم", name_he: "בנק הפועלים", code: "12" },
  { id: "leumi", name_ar: "بنك لئومي", name_he: "בנק לאומי", code: "10" },
  { id: "discount", name_ar: "بنك ديسكونت", name_he: "בנק דיסקונט", code: "11" },
  { id: "mizrahi", name_ar: "بنك مزراحي طفحوت", name_he: "בנק מזרחי טפחות", code: "20" },
  { id: "benleumi", name_ar: "البنك الدولي الأول", name_he: "הבנק הבינלאומי הראשון", code: "31" },
  { id: "yahav", name_ar: "بنك يهاف", name_he: "בנק יהב", code: "04" },
  { id: "mercantile", name_ar: "بنك مركنتيل", name_he: "בנק מרכנתיל", code: "17" },
  { id: "otsar", name_ar: "بنك أوتسار هحيال", name_he: "בנק אוצר החייל", code: "14" },
  { id: "union", name_ar: "بنك الاتحاد", name_he: "בנק איגוד", code: "13" },
  { id: "masad", name_ar: "بنك مساد", name_he: "בנק מסד", code: "46" },
  { id: "jerusalem", name_ar: "بنك القدس", name_he: "בנק ירושלים", code: "54" },
  { id: "dexia", name_ar: "بنك دكسيا", name_he: "בנק דקסיה", code: "68" },
  { id: "poaley_agudat", name_ar: "بنك بوعلي أغودات", name_he: "בנק פועלי אגודת ישראל", code: "52" },
  { id: "arab_israel", name_ar: "البنك العربي الإسرائيلي", name_he: "הבנק הערבי ישראלי", code: "34" },
] as const;
// ⛔ بنك البريد (בנק הדואר) غير معتمد

// ===== Cities =====
export const CITIES = [
  "حيفا", "يافا", "الناصرة", "عكا", "اللد", "الرملة",
  "أم الفحم", "سخنين", "طمرة", "شفاعمرو", "باقة الغربية",
  "الطيبة", "كفر قاسم", "رهط", "نتانيا", "تل أبيب",
  "القدس", "بئر السبع", "عرابة", "كفر كنا", "دبورية",
  "كفر ياسيف", "جديدة المكر", "طرعان", "المغار",
  "كابول", "عرعرة", "جلجولية", "الطيرة", "قلنسوة",
] as const;

// ===== Integration Providers =====
export const INTEGRATION_TYPES = {
  whatsapp: {
    label: "WhatsApp",
    icon: "💬",
    providers: ["yCloud", "Meta API", "Twilio", "360Dialog", "WATI"],
  },
  email: {
    label: "Email",
    icon: "📧",
    providers: ["SendGrid", "Mailgun", "Amazon SES", "SMTP"],
  },
  payment: {
    label: "الدفع",
    icon: "💳",
    providers: ["רווחית (Rivhit)", "Tranzila", "PayPlus", "Stripe"],
  },
  sms: {
    label: "SMS",
    icon: "📱",
    providers: ["InforUMobile", "Twilio SMS", "019SMS"],
  },
  crm_external: {
    label: "CRM خارجي",
    icon: "🔄",
    providers: ["HubSpot", "Salesforce", "Monday"],
  },
  analytics: {
    label: "Analytics",
    icon: "📊",
    providers: ["Google Analytics", "Mixpanel", "Hotjar"],
  },
} as const;

// ===== Payment =====
export const INSTALLMENT_OPTIONS = [1, 3, 6, 12, 18] as const;

// ===== Product Types =====
export const PRODUCT_TYPES = {
  device:    { label: "جهاز",     labelHe: "מכשיר",    icon: "📱" },
  accessory: { label: "إكسسوار",  labelHe: "אביזר",   icon: "🔌" },
} as const;
