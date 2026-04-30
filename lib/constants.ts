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
  pipeline: { label: "فايبلاين", labelHe: "פייפליין", color: "#0ea5e9", icon: "🎯" },
  phone: { label: "هاتف", labelHe: "טלפון", color: "#14b8a6", icon: "📞" },
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
  admin: ["products", "orders", "orders.create", "orders.edit", "customers", "tasks", "pipeline", "coupons", "heroes", "lines", "emails", "settings"],
  sales: ["orders", "orders.create", "orders.edit", "customers", "tasks", "pipeline"],
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
  whatsapp: { label: "WhatsApp", icon: "💬", providers: ["yCloud"] as readonly string[] },
  sms: { label: "SMS / OTP", icon: "📱", providers: ["Twilio SMS"] as readonly string[] },
  payment: { label: "الدفع — إسرائيل", icon: "💳", providers: ["רווחית (Rivhit)"] as readonly string[] },
  payment_upay: { label: "الدفع — فلسطين والعالم", icon: "💳", providers: ["UPay"] as readonly string[] },
  email: { label: "Email", icon: "📧", providers: ["Resend", "SendGrid"] as readonly string[] },
  ai_chat: { label: "ذكاء اصطناعي (بوت + بحث)", icon: "🤖", providers: ["Anthropic Claude"] as readonly string[] },
  ai_admin: { label: "ذكاء الإدارة", icon: "🧠", providers: ["OpenAI"] as readonly string[] },
  ai_intelligence: { label: "الذكاء الكتالوجي (Opus)", icon: "🧠", providers: ["Anthropic Claude"] as readonly string[] },
  ai_vision: { label: "رؤية AI (للصور)", icon: "👁️", providers: ["Vercel AI Gateway"] as readonly string[] },
  image_search: { label: "بحث صور المنتجات", icon: "🔍", providers: ["Google CSE", "Bing"] as readonly string[] },
  image_enhance: { label: "تحسين الصور", icon: "🖼️", providers: ["Remove.bg"] as readonly string[] },
  device_data: { label: "بيانات الأجهزة", icon: "📱", providers: ["MobileAPI.dev"] as readonly string[] },
  stock_images: { label: "الصور الإضافية", icon: "🗂️", providers: ["Pexels"] as readonly string[] },
  storage: { label: "تخزين الصور", icon: "☁️", providers: ["Cloudflare R2"] as readonly string[] },
  push_notifications: { label: "إشعارات Push", icon: "🔔", providers: ["Web Push (VAPID)"] as readonly string[] },
  webhook_security: { label: "أسرار Webhook", icon: "🛡️", providers: ["Internal Webhooks"] as readonly string[] },
} as const;

(INTEGRATION_TYPES.ai_chat.providers as unknown as string[]).push("Google Gemini");

export const PRODUCT_TYPES = {
  device: { label: "جهاز", labelHe: "מכשיר", icon: "📱" },
  accessory: { label: "إكسسوار", labelHe: "אביזר", icon: "🔌" },
  appliance: { label: "جهاز ذكي", labelHe: "מכשיר חכם", icon: "🏠" },
  tv: { label: "تلفزيون", labelHe: "טלוויזיה", icon: "📺" },
  computer: { label: "كمبيوتر", labelHe: "מחשב", icon: "💻" },
  tablet: { label: "تابلت", labelHe: "טאבלט", icon: "📱" },
  network: { label: "شبكة / راوتر", labelHe: "ראוטר / רשת", icon: "📡" },
} as const;

// Number of installments shown next to the cash price.
// Cash price is for "نقد أو حتى 18 قسط بدون فوائد" — long installments use a separate `monthly_price` field.
export const INSTALLMENTS_BY_TYPE: Record<string, number> = {
  device: 36,
  appliance: 36,
  tv: 36,
  computer: 36,
  tablet: 36,
  network: 18,
  accessory: 0, // accessories: cash only, no installment line shown
};

export const APPLIANCE_KINDS = {
  robot_vacuum: { label: "روبوت فاكوم", labelHe: "שואב רובוטי", icon: "🤖" },
  air_fryer: { label: "قلاية هوائية", labelHe: "מטגן אוויר", icon: "🍟" },
  espresso: { label: "آلة إسبرسو", labelHe: "מכונת אספרסו", icon: "☕" },
  kettle: { label: "غلاية كهربائية", labelHe: "קומקום חשמלי", icon: "🫖" },
  blender: { label: "خلاط ذكي", labelHe: "בלנדר חכם", icon: "🥤" },
  ninja_pot: { label: "طنجرة نينجا", labelHe: "סיר נינג'ה", icon: "🍲" },
  coffee_maker: { label: "ماكينة قهوة", labelHe: "מכונת קפה", icon: "☕" },
  iron: { label: "مكواة بخار", labelHe: "מגהץ קיטור", icon: "👔" },
  hair_dryer: { label: "مجفف شعر", labelHe: "מייבש שיער", icon: "💨" },
  smart_speaker: { label: "سماعة ذكية", labelHe: "רמקול חכם", icon: "🔊" },
  food_processor: { label: "معالج طعام", labelHe: "מעבד מזון", icon: "🥘" },
  stand_mixer: { label: "خلاط مكتبي", labelHe: "מיקסר שולחני", icon: "🥣" },
  stick_vacuum: { label: "مكنسة عمودية", labelHe: "שואב מקל", icon: "🧹" },
  hair_styler: { label: "مصفف شعر", labelHe: "מעצב שיער", icon: "💇" },
  shaver_trimmer: { label: "ماكينة حلاقة", labelHe: "מכונת גילוח", icon: "💈" },
  juicer: { label: "عصارة", labelHe: "מסחטה", icon: "🍊" },
  toaster: { label: "محمصة خبز", labelHe: "מצנם", icon: "🍞" },
  steam_grill: { label: "شواية كهربائية", labelHe: "גריל חשמלי", icon: "🥩" },
  popcorn: { label: "ماكينة فشار", labelHe: "מכונת פופקורן", icon: "🍿" },
  ice_maker: { label: "ماكينة آيس كريم/جليد", labelHe: "מכונת קרח/גלידה", icon: "🍦" },
  ipl_hair_removal: { label: "إزالة شعر IPL", labelHe: "מסיר שיער IPL", icon: "✨" },
  cookware_set: { label: "طقم طناجر/سكاكين", labelHe: "סט סירים/סכינים", icon: "🍳" },
  fan: { label: "مروحة", labelHe: "מאוורר", icon: "🌀" },
  microwave: { label: "ميكروويف", labelHe: "מיקרוגל", icon: "♨️" },
  other: { label: "أخرى", labelHe: "אחר", icon: "🏠" },
} as const;

export const TV_SUBKINDS = {
  oled: { label: "OLED", labelHe: "OLED", icon: "🖥️" },
  qled: { label: "QLED", labelHe: "QLED", icon: "📺" },
  neo_qled: { label: "Neo QLED", labelHe: "Neo QLED", icon: "📺" },
  mini_led: { label: "Mini LED", labelHe: "Mini LED", icon: "📺" },
  uhd: { label: "UHD 4K", labelHe: "UHD 4K", icon: "📺" },
  nano: { label: "NANO Cell", labelHe: "NANO", icon: "📺" },
  fhd: { label: "Full HD", labelHe: "FHD", icon: "📺" },
  other: { label: "أخرى", labelHe: "אחר", icon: "📺" },
} as const;

export const COMPUTER_SUBKINDS = {
  laptop_gaming: { label: "لابتوب ألعاب", labelHe: "לפטופ גיימינג", icon: "🎮" },
  laptop_business: { label: "لابتوب أعمال", labelHe: "לפטופ עסקי", icon: "💼" },
  laptop_2in1: { label: "لابتوب 2-in-1", labelHe: "לפטופ 2 ב-1", icon: "🔄" },
  desktop: { label: "كمبيوتر مكتبي", labelHe: "מחשב נייח", icon: "🖥️" },
  printer_inkjet: { label: "طابعة حبر", labelHe: "מדפסת הזרקת דיו", icon: "🖨️" },
  printer_laser: { label: "طابعة ليزر", labelHe: "מדפסת לייזר", icon: "🖨️" },
  printer_aio: { label: "طابعة متعددة الوظائف", labelHe: "מדפסת רב-תכליתית", icon: "🖨️" },
  other: { label: "أخرى", labelHe: "אחר", icon: "💻" },
} as const;

export const TABLET_SUBKINDS = {
  apple_pro: { label: "iPad Pro", labelHe: "iPad Pro", icon: "📱" },
  apple_air: { label: "iPad Air", labelHe: "iPad Air", icon: "📱" },
  apple_basic: { label: "iPad / Mini", labelHe: "iPad / Mini", icon: "📱" },
  kids: { label: "تابلت أطفال", labelHe: "טאבלט לילדים", icon: "👶" },
  android: { label: "أندرويد", labelHe: "אנדרואיד", icon: "🤖" },
  other: { label: "أخرى", labelHe: "אחר", icon: "📱" },
} as const;

export const NETWORK_SUBKINDS = {
  router_mesh: { label: "راوتر Mesh", labelHe: "ראוטר Mesh", icon: "📡" },
  wifi_extender: { label: "موسّع شبكة", labelHe: "מגדיל טווח", icon: "📶" },
  switch: { label: "سويتش", labelHe: "מתג", icon: "🔌" },
  access_point: { label: "نقطة وصول", labelHe: "נקודת גישה", icon: "📡" },
  other: { label: "أخرى", labelHe: "אחר", icon: "📡" },
} as const;

export const ACCESSORY_SUBKINDS = {
  case:                { label: "جراب موبايل",        labelHe: "כיסוי לטלפון",     icon: "📱" },
  case_tablet:         { label: "جراب تابلت",         labelHe: "כיסוי לטאבלט",     icon: "📱" },
  case_laptop:         { label: "جراب لابتوب",        labelHe: "תיק ללפטופ",        icon: "💻" },
  screen_protector:    { label: "واقي شاشة",          labelHe: "מגן מסך",          icon: "🛡️" },
  charger_wall:        { label: "شاحن جداري",         labelHe: "מטען קיר",          icon: "🔌" },
  charger_car:         { label: "شاحن سيارة",         labelHe: "מטען לרכב",         icon: "🚗" },
  charger_wireless:    { label: "شاحن لاسلكي",        labelHe: "מטען אלחוטי",      icon: "🔋" },
  charger_watch:       { label: "شاحن ساعة",          labelHe: "מטען לשעון",       icon: "⌚" },
  cable:               { label: "كابل",                labelHe: "כבל",               icon: "🔗" },
  adapter:             { label: "محول",                labelHe: "מתאם",              icon: "🔄" },
  power_bank:          { label: "باور بانك",          labelHe: "סוללה ניידת",      icon: "🔋" },
  earbuds:             { label: "سماعات أذن لاسلكية", labelHe: "אוזניות אלחוטיות",  icon: "🎧" },
  headphones:          { label: "سماعات رأس",         labelHe: "אוזניות ראש",       icon: "🎧" },
  earphones_wired:     { label: "سماعات سلكية",       labelHe: "אוזניות חוטיות",   icon: "🎧" },
  speaker_bluetooth:   { label: "سبيكر بلوتوث",       labelHe: "רמקול בלוטות",     icon: "🔊" },
  holder_car:          { label: "حامل سيارة",         labelHe: "מחזיק לרכב",       icon: "🚗" },
  holder_desk:         { label: "حامل مكتبي",         labelHe: "מעמד שולחני",      icon: "🖥️" },
  selfie_stick:        { label: "عصا سيلفي",          labelHe: "מקל סלפי",         icon: "🤳" },
  tripod:              { label: "حامل ثلاثي",         labelHe: "חצובה",             icon: "📷" },
  stylus:              { label: "قلم لمس",            labelHe: "עט מגע",            icon: "🖊️" },
  memory_card:         { label: "بطاقة ذاكرة",        labelHe: "כרטיס זיכרון",     icon: "💾" },
  usb_drive:           { label: "فلاش / SSD محمول",   labelHe: "כונן USB / SSD",   icon: "💾" },
  watch_band:          { label: "سوار ساعة",          labelHe: "רצועת שעון",        icon: "⌚" },
  magsafe:             { label: "ملحقات ماغ سيف",     labelHe: "אביזרי MagSafe",   icon: "🧲" },
  ring_holder:         { label: "حلقة / PopSocket",   labelHe: "טבעת / פופ-סוקט",  icon: "💍" },
  gaming_grip:         { label: "مقبض ألعاب",         labelHe: "ידית גיימינג",     icon: "🎮" },
  lens_attachment:     { label: "عدسة كاميرا",        labelHe: "עדשת מצלמה",       icon: "📷" },
  ring_light:          { label: "إضاءة رينج",          labelHe: "אור טבעתי",         icon: "💡" },
  microphone:          { label: "مايكروفون",           labelHe: "מיקרופון",          icon: "🎤" },
  gimbal:              { label: "جيمبال / مثبّت",     labelHe: "גימבל",             icon: "🎬" },
  cleaning_kit:        { label: "طقم تنظيف",          labelHe: "ערכת ניקוי",        icon: "🧽" },
  battery_replacement: { label: "بطارية بديلة",       labelHe: "סוללה חלופית",     icon: "🔋" },
  sim_tool:            { label: "أداة فتح السيم",     labelHe: "כלי לפתיחת SIM",   icon: "🔧" },
  vr_headset:          { label: "نظارة VR",           labelHe: "משקפי VR",         icon: "🥽" },
  other:               { label: "أخرى",                labelHe: "אחר",               icon: "🔌" },
} as const;
