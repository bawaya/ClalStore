"use client";

import { useEffect, useState, useMemo } from "react";
import { BarChart } from "@/components/admin/charts/BarChart";
import { LineChart } from "@/components/admin/charts/LineChart";
import { DonutChart } from "@/components/admin/charts/DonutChart";

// ===== Types =====

interface Metrics {
  totalRevenue: number;
  prevRevenue: number;
  revenueChange: number;
  totalOrders: number;
  prevOrders: number;
  ordersChange: number;
  avgOrderValue: number;
  newCustomers: number;
  prevCustomers: number;
  customersChange: number;
  conversionRate: number;
  abandonmentRate: number;
  recoveredCarts: number;
  totalCarts: number;
}

interface ChartDatum {
  label: string;
  value: number;
}

interface DashboardData {
  metrics: Metrics;
  dailyRevenue: ChartDatum[];
  topProducts: ChartDatum[];
  statusDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
  customerGrowth: ChartDatum[];
}

// ===== Color palettes =====

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  confirmed: "#22c55e",
  processing: "#f59e0b",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
  returned: "#f97316",
  refunded: "#ec4899",
  no_reply_1: "#eab308",
  no_reply_2: "#f97316",
  no_reply_3: "#ef4444",
};

const SOURCE_COLORS: Record<string, string> = {
  store: "#c41040",
  whatsapp: "#25d366",
  facebook: "#1877f2",
  instagram: "#e4405f",
  direct: "#a855f7",
  phone: "#f59e0b",
  referral: "#06b6d4",
};

const DONUT_PALETTE = ["#c41040", "#6366f1", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#ef4444", "#10b981", "#f97316"];

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  processing: "قيد المعالجة",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مرتجع",
  refunded: "مسترجع",
  no_reply_1: "بدون رد 1",
  no_reply_2: "بدون رد 2",
  no_reply_3: "بدون رد 3",
};

const SOURCE_LABELS: Record<string, string> = {
  store: "المتجر",
  whatsapp: "واتساب",
  facebook: "فيسبوك",
  instagram: "انستغرام",
  direct: "مباشر",
  phone: "هاتف",
  referral: "إحالة",
};

// ===== Main page =====

export default function AdvancedAnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics/dashboard")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.error || "فشل تحميل البيانات");
      })
      .catch(() => setError("خطأ في الاتصال بالخادم"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <div className="p-6 text-center" dir="rtl">
        <p className="text-state-error font-bold">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-4 desktop:p-6 space-y-6" dir="rtl">
      <Header />
      <MetricsGrid metrics={data.metrics} />

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        <ChartCard title="الإيرادات اليومية" subtitle="آخر 30 يوم">
          <BarChart
            data={data.dailyRevenue}
            color="#c41040"
            height={200}
            formatValue={(v) => `₪${v.toLocaleString()}`}
          />
        </ChartCard>

        <ChartCard title="نمو العملاء" subtitle="أسبوعي — آخر 90 يوم">
          <LineChart
            data={data.customerGrowth}
            color="#22c55e"
            height={200}
            formatValue={(v) => `${v} عميل`}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-4">
        <ChartCard title="حالات الطلبات" subtitle="هذا الشهر">
          <StatusDonut distribution={data.statusDistribution} />
        </ChartCard>

        <ChartCard title="مصادر الطلبات" subtitle="هذا الشهر">
          <SourceDonut distribution={data.sourceDistribution} />
        </ChartCard>

        <ChartCard title="أكثر المنتجات مبيعاً" subtitle="إجمالي">
          <TopProductsBars products={data.topProducts} />
        </ChartCard>
      </div>
    </div>
  );
}

// ===== Header =====

function Header() {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-xl font-black">التحليلات المتقدمة</h1>
        <p className="text-xs text-muted mt-0.5">نظرة شاملة على أداء المتجر</p>
      </div>
    </div>
  );
}

// ===== Metrics Grid =====

function MetricsGrid({ metrics }: { metrics: Metrics }) {
  const cards = [
    {
      label: "إجمالي الإيرادات",
      value: `₪${metrics.totalRevenue.toLocaleString()}`,
      sub: `الشهر الماضي: ₪${metrics.prevRevenue.toLocaleString()}`,
      change: metrics.revenueChange,
      icon: "💰",
      accent: "#22c55e",
    },
    {
      label: "إجمالي الطلبات",
      value: metrics.totalOrders,
      sub: `الشهر الماضي: ${metrics.prevOrders}`,
      change: metrics.ordersChange,
      icon: "📦",
      accent: "#6366f1",
    },
    {
      label: "متوسط قيمة الطلب",
      value: `₪${metrics.avgOrderValue.toLocaleString()}`,
      icon: "📊",
      accent: "#f59e0b",
    },
    {
      label: "عملاء جدد",
      value: metrics.newCustomers,
      sub: `الشهر الماضي: ${metrics.prevCustomers}`,
      change: metrics.customersChange,
      icon: "👥",
      accent: "#06b6d4",
    },
    {
      label: "معدل التحويل",
      value: `${metrics.conversionRate}%`,
      sub: `${metrics.totalOrders} طلب من ${metrics.totalOrders + metrics.totalCarts}`,
      icon: "🎯",
      accent: "#a855f7",
    },
    {
      label: "سلال متروكة",
      value: `${metrics.abandonmentRate}%`,
      sub: `${metrics.recoveredCarts} مسترجعة من ${metrics.totalCarts}`,
      icon: "🛒",
      accent: "#ef4444",
    },
  ];

  return (
    <div className="grid grid-cols-2 desktop:grid-cols-3 gap-3">
      {cards.map((c) => (
        <MetricCard key={c.label} {...c} />
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  change,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  change?: number;
  icon: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-card border border-surface-border p-4 relative overflow-hidden transition-all hover:border-opacity-50"
      style={{ background: "linear-gradient(135deg, #111114 0%, #18181b 100%)" }}
    >
      <div
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}00, ${accent}, ${accent}00)` }}
      />

      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] text-muted font-semibold">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>

      <p className="text-2xl font-black mb-1">{value}</p>

      {sub && <p className="text-[10px] text-dim">{sub}</p>}

      {change !== undefined && change !== 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-chip"
            style={{
              color: change > 0 ? "#22c55e" : "#ef4444",
              background: change > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            }}
          >
            {change > 0 ? "↑" : "↓"} {Math.abs(change)}%
          </span>
          <span className="text-[9px] text-dim">عن الشهر الماضي</span>
        </div>
      )}
    </div>
  );
}

// ===== Chart Card wrapper =====

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-card border border-surface-border p-4 desktop:p-5"
      style={{ background: "linear-gradient(135deg, #111114 0%, #141417 100%)" }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ===== Donut wrappers =====

function StatusDonut({ distribution }: { distribution: Record<string, number> }) {
  const chartData = useMemo(
    () =>
      Object.entries(distribution)
        .sort(([, a], [, b]) => b - a)
        .map(([key, value]) => ({
          label: STATUS_LABELS[key] || key,
          value,
          color: STATUS_COLORS[key] || DONUT_PALETTE[Object.keys(distribution).indexOf(key) % DONUT_PALETTE.length],
        })),
    [distribution]
  );
  return <DonutChart data={chartData} size={180} />;
}

function SourceDonut({ distribution }: { distribution: Record<string, number> }) {
  const chartData = useMemo(
    () =>
      Object.entries(distribution)
        .sort(([, a], [, b]) => b - a)
        .map(([key, value]) => ({
          label: SOURCE_LABELS[key] || key,
          value,
          color: SOURCE_COLORS[key] || DONUT_PALETTE[Object.keys(distribution).indexOf(key) % DONUT_PALETTE.length],
        })),
    [distribution]
  );
  return <DonutChart data={chartData} size={180} />;
}

// ===== Top Products horizontal bars =====

function TopProductsBars({ products }: { products: ChartDatum[] }) {
  const max = Math.max(...products.map((p) => p.value), 1);

  if (products.length === 0) {
    return <p className="text-xs text-dim py-4 text-center">لا توجد بيانات</p>;
  }

  return (
    <div className="space-y-2.5">
      {products.map((p, i) => {
        const pct = (p.value / max) * 100;
        const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
        return (
          <div key={i}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted truncate max-w-[60%]">{p.label}</span>
              <span className="text-[10px] font-bold">{p.value}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Loading skeleton =====

function LoadingSkeleton() {
  return (
    <div className="p-4 desktop:p-6 space-y-6 animate-pulse" dir="rtl">
      <div className="h-7 w-48 bg-surface-elevated rounded-lg" />

      <div className="grid grid-cols-2 desktop:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-card rounded-card border border-surface-border p-4 h-28">
            <div className="h-3 w-16 bg-surface-elevated rounded mb-3" />
            <div className="h-7 w-24 bg-surface-elevated rounded mb-2" />
            <div className="h-2 w-20 bg-surface-elevated rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-surface-card rounded-card border border-surface-border p-5 h-64">
            <div className="h-4 w-28 bg-surface-elevated rounded mb-4" />
            <div className="h-40 bg-surface-elevated rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface-card rounded-card border border-surface-border p-5 h-72">
            <div className="h-4 w-28 bg-surface-elevated rounded mb-4" />
            <div className="h-44 bg-surface-elevated rounded-full mx-auto w-44" />
          </div>
        ))}
      </div>
    </div>
  );
}
