import type { CRMData, InboxData, TaskItem, AnalyticsData, ExpenseItem, MonthlyRow, TxItem, RevenueStream } from "./types";

// ── Colors ──
export const GOLD = "#F6C445", CYAN = "#00E5FF", DARK = "#0A0A0F", CARD = "#12121A",
  CARD2 = "#1A1A28", BORDER = "#2A2A3A", TEXT = "#E8E8F0", MUTED = "#8888AA",
  RED = "#FF4D6A", GREEN = "#00E676", PURPLE = "#B388FF", BRAND_DEFAULT = "#c41040",
  TEAL_DEFAULT = "#2ED8A3";

// ── Demo Data ──
export const DEMO_CRM: CRMData = {
  revenue: 48500, totalOrders: 37, newCount: 5, totalCustomers: 142, vipCount: 12,
  pipelineValue: 85000, pipelineDeals: 8,
  byStatus: { new: 5, approved: 8, processing: 6, shipped: 4, delivered: 12, cancelled: 2 },
  bySource: { store: 18, whatsapp: 12, facebook: 4, direct: 3 },
  recentOrders: [
    { id: "CLM-10042", total: 3200, status: "new", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "CLM-10041", total: 1800, status: "approved", created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: "CLM-10040", total: 4500, status: "shipped", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: "CLM-10039", total: 2900, status: "delivered", created_at: new Date(Date.now() - 172800000).toISOString() },
  ],
  alerts: [
    { msg: "5 طلبات جديدة بانتظار المراجعة", count: 5, color: "#3b82f6" },
    { msg: "3 طلبات بدون رد منذ 24 ساعة", count: 3, color: "#f97316" },
  ],
};

export const DEMO_INBOX: InboxData = { active: 12, waiting: 5, bot: 34, resolved_today: 8, messages_today: 47, unread_total: 15 };

export const DEMO_TASKS: TaskItem[] = [
  { id: "t1", title: "متابعة طلب CLM-10042", priority: "high", status: "open", due_date: new Date(Date.now() + 86400000).toISOString() },
  { id: "t2", title: "اتصال عميل VIP — أحمد", priority: "high", status: "in_progress" },
  { id: "t3", title: "تحديث أسعار Samsung", priority: "medium", status: "open", due_date: new Date(Date.now() + 172800000).toISOString() },
  { id: "t4", title: "إرسال عروض الأسبوع", priority: "medium", status: "done" },
  { id: "t5", title: "مراجعة تقييمات العملاء", priority: "low", status: "open" },
  { id: "t6", title: "تجديد باقات HOT", priority: "high", status: "in_progress" },
  { id: "t7", title: "تصوير منتجات جديدة", priority: "low", status: "done" },
  { id: "t8", title: "تقرير مبيعات شهري", priority: "medium", status: "open", due_date: new Date(Date.now() + 259200000).toISOString() },
];

export const DEMO_ANALYTICS: AnalyticsData = {
  metrics: { totalRevenue: 48500, prevRevenue: 41200, revenueChange: 18, totalOrders: 37, prevOrders: 29, ordersChange: 28, avgOrderValue: 1311, newCustomers: 23, prevCustomers: 18, customersChange: 28, conversionRate: 34, abandonmentRate: 22 },
  dailyRevenue: [
    { label: "15/3", value: 2800 }, { label: "16/3", value: 3500 }, { label: "17/3", value: 2200 },
    { label: "18/3", value: 4100 }, { label: "19/3", value: 3800 }, { label: "20/3", value: 2900 },
    { label: "21/3", value: 4500 }, { label: "22/3", value: 3200 }, { label: "23/3", value: 5100 },
    { label: "24/3", value: 3700 }, { label: "25/3", value: 4800 }, { label: "26/3", value: 2600 },
    { label: "27/3", value: 5000 }, { label: "28/3", value: 4200 },
  ],
  topProducts: [
    { label: "iPhone 16 Pro Max", value: 8 }, { label: "Galaxy S25 Ultra", value: 6 },
    { label: "AirPods Pro 2", value: 5 }, { label: "Xiaomi 15", value: 4 }, { label: "Galaxy A55", value: 3 },
  ],
  customerGrowth: [
    { label: "W1", value: 8 }, { label: "W2", value: 12 }, { label: "W3", value: 15 },
    { label: "W4", value: 11 }, { label: "W5", value: 18 }, { label: "W6", value: 23 },
  ],
};

const EXPENSE_CATEGORIES = [
  { id: "inventory", name: "مخزون وبضاعة", icon: "📦", color: "#6366f1", budget: 25000 },
  { id: "salaries", name: "رواتب وأجور", icon: "👥", color: "#f59e0b", budget: 12000 },
  { id: "shipping", name: "شحن وتوصيل", icon: "🚚", color: "#22c55e", budget: 3000 },
  { id: "marketing", name: "تسويق وإعلانات", icon: "📢", color: "#ef4444", budget: 5000 },
  { id: "software", name: "اشتراكات وبرمجيات", icon: "💻", color: "#8b5cf6", budget: 2500 },
  { id: "rent", name: "إيجار ومرافق", icon: "🏢", color: "#06b6d4", budget: 4000 },
  { id: "telecom", name: "اتصالات HOT", icon: "📡", color: "#ec4899", budget: 1500 },
  { id: "misc", name: "مصاريف متفرقة", icon: "📌", color: "#a1a1aa", budget: 2000 },
];

const multipliers = [0.71, 0.91, 0.60, 0.91, 1.07, 0.98, 0.91, 1.04];
export const DEMO_EXPENSES: ExpenseItem[] = EXPENSE_CATEGORIES.map((c, i) => ({
  ...c, actual: Math.floor(c.budget * multipliers[i]),
}));

export const DEMO_MONTHLY: MonthlyRow[] = [
  { month: "يناير", revenue: 32500, expenses: 24800, profit: 7700, orders: 22, avgOrder: 1477 },
  { month: "فبراير", revenue: 38200, expenses: 27100, profit: 11100, orders: 28, avgOrder: 1364 },
  { month: "مارس", revenue: 48500, expenses: 31200, profit: 17300, orders: 37, avgOrder: 1311 },
  { month: "أبريل", revenue: 43800, expenses: 29500, profit: 14300, orders: 32, avgOrder: 1369 },
  { month: "مايو", revenue: 51200, expenses: 33800, profit: 17400, orders: 40, avgOrder: 1280 },
  { month: "يونيو", revenue: 46900, expenses: 30100, profit: 16800, orders: 35, avgOrder: 1340 },
];

export const DEMO_TRANSACTIONS: TxItem[] = [
  { id: 1, date: "2026-03-28", type: "income", category: "مبيعات أجهزة", amount: 4500, note: "iPhone 16 Pro — CLM-10042", method: "بطاقة" },
  { id: 2, date: "2026-03-28", type: "income", category: "مبيعات إكسسوارات", amount: 380, note: "AirPods Pro + كفر", method: "بطاقة" },
  { id: 3, date: "2026-03-27", type: "expense", category: "مخزون وبضاعة", amount: 12500, note: "شحنة Samsung — 5 أجهزة", method: "تحويل بنكي" },
  { id: 4, date: "2026-03-27", type: "income", category: "مبيعات أجهزة", amount: 3200, note: "Galaxy S25 — CLM-10041", method: "تحويل بنكي" },
  { id: 5, date: "2026-03-26", type: "expense", category: "تسويق وإعلانات", amount: 1200, note: "حملة Facebook + Instagram", method: "بطاقة" },
  { id: 6, date: "2026-03-26", type: "expense", category: "شحن وتوصيل", amount: 450, note: "شحن 8 طلبات", method: "نقد" },
  { id: 7, date: "2026-03-25", type: "income", category: "باقات HOT", amount: 890, note: "3 باقات جديدة", method: "بطاقة" },
  { id: 8, date: "2026-03-25", type: "expense", category: "رواتب وأجور", amount: 6000, note: "رواتب مارس — دفعة أولى", method: "تحويل بنكي" },
  { id: 9, date: "2026-03-24", type: "income", category: "مبيعات أجهزة", amount: 5800, note: "Xiaomi 15 Pro x2", method: "بطاقة" },
  { id: 10, date: "2026-03-24", type: "expense", category: "اشتراكات وبرمجيات", amount: 850, note: "Supabase + Cloudflare", method: "بطاقة" },
  { id: 11, date: "2026-03-23", type: "expense", category: "إيجار ومرافق", amount: 4000, note: "إيجار شهر مارس", method: "تحويل بنكي" },
  { id: 12, date: "2026-03-23", type: "income", category: "مبيعات أجهزة", amount: 2100, note: "Galaxy A55 — CLM-10038", method: "بطاقة" },
];

export const REVENUE_STREAMS: RevenueStream[] = [
  { name: "أجهزة", value: 38200, color: BRAND_DEFAULT },
  { name: "إكسسوارات", value: 5400, color: PURPLE },
  { name: "باقات HOT", value: 3100, color: CYAN },
  { name: "خدمات أخرى", value: 1800, color: GOLD },
];

// ── Label/Color Maps ──
export const STATUS_COLORS: Record<string, string> = { new: "#3b82f6", approved: "#22c55e", processing: "#f59e0b", shipped: "#8b5cf6", delivered: "#10b981", cancelled: "#ef4444" };
export const STATUS_LABELS: Record<string, string> = { new: "جديد", approved: "مؤكد", processing: "تجهيز", shipped: "شحن", delivered: "تسليم", cancelled: "ملغي" };
export const SOURCE_LABELS: Record<string, string> = { store: "المتجر", whatsapp: "واتساب", facebook: "فيسبوك", direct: "مباشر" };
export const SOURCE_COLORS: Record<string, string> = { store: BRAND_DEFAULT, whatsapp: "#25d366", facebook: "#1877f2", direct: "#a855f7" };
export const PRIORITY_COLORS: Record<string, string> = { high: GOLD, medium: CYAN, low: MUTED };
export const PRIORITY_LABELS: Record<string, string> = { high: "عاجل", medium: "عادي", low: "منخفض" };
