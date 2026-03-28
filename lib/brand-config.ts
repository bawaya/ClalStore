// ═══════════════════════════════════════════════════════════
// Command Center — White-Label Configuration
// غيّر هاد الملف حسب مشروعك وخلص!
// ═══════════════════════════════════════════════════════════

export type BrandConfig = {
  name: string;
  logo: string;
  tagline?: string;
  baseUrl: string;
  apiPrefix?: string;
  colors?: {
    brand?: string;
    accent?: string;
    gold?: string;
    cyan?: string;
    teal?: string;
  };
  features?: {
    dashboard?: boolean;
    kanban?: boolean;
    finance?: boolean;
    analytics?: boolean;
    inbox?: boolean;
  };
  currency?: string;
  locale?: string;
  direction?: "rtl" | "ltr";
};

// ─────────────────────────────────────────
// ClalMobile — متجر إلكترونيات
// ─────────────────────────────────────────
export const CLALMOBILE_CONFIG: BrandConfig = {
  name: "ClalMobile Command Center",
  logo: "C",
  tagline: "مركز إدارة المتجر",
  baseUrl: "",
  colors: {
    brand: "#c41040",
    accent: "#00E5FF",
    gold: "#F6C445",
    cyan: "#00E5FF",
    teal: "#2ED8A3",
  },
  features: {
    dashboard: true,
    kanban: true,
    finance: true,
    analytics: true,
    inbox: true,
  },
  currency: "₪",
  locale: "ar-EG",
  direction: "rtl",
};

// ─────────────────────────────────────────
// EZOrder — منصة طلبات مخابز
// ─────────────────────────────────────────
export const EZORDER_CONFIG: BrandConfig = {
  name: "EZOrder Dashboard",
  logo: "🍰",
  tagline: "لوحة إدارة الطلبات",
  baseUrl: "",
  colors: {
    brand: "#e67e22",
    accent: "#2ecc71",
    gold: "#f1c40f",
    cyan: "#1abc9c",
    teal: "#27ae60",
  },
  features: {
    dashboard: true,
    kanban: true,
    finance: true,
    analytics: true,
    inbox: false,
  },
  currency: "₪",
  locale: "ar-EG",
  direction: "rtl",
};

// ─────────────────────────────────────────
// Fatima.AI — أكاديمية ريادة أعمال
// ─────────────────────────────────────────
export const FATIMA_AI_CONFIG: BrandConfig = {
  name: "Fatima.AI Dashboard",
  logo: "F",
  tagline: "لوحة إدارة الأكاديمية",
  baseUrl: "",
  colors: {
    brand: "#0ea5e9",
    accent: "#d4af37",
    gold: "#d4af37",
    cyan: "#0ea5e9",
    teal: "#06d6a0",
  },
  features: {
    dashboard: true,
    kanban: true,
    finance: true,
    analytics: true,
    inbox: true,
  },
  currency: "₪",
  locale: "ar-EG",
  direction: "rtl",
};

// ─────────────────────────────────────────
// Helper: ادمج config مع القيم الافتراضية
// ─────────────────────────────────────────
export const DEFAULT_COLORS = {
  brand: "#c41040",
  accent: "#00E5FF",
  gold: "#F6C445",
  cyan: "#00E5FF",
  teal: "#2ED8A3",
};

export function resolveConfig(config: BrandConfig) {
  return {
    ...config,
    apiPrefix: config.apiPrefix || "/api",
    currency: config.currency || "₪",
    locale: config.locale || "ar-EG",
    direction: config.direction || "rtl",
    colors: { ...DEFAULT_COLORS, ...config.colors },
    features: {
      dashboard: true,
      kanban: true,
      finance: true,
      analytics: true,
      inbox: true,
      ...config.features,
    },
  };
}
