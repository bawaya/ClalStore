"use client";

import { useEffect, useState } from "react";

const FEATURE_LABELS: Record<string, string> = {
  bot_reply: "رد البوت",
  smart_reply: "رد ذكي CRM",
  summary: "ملخص محادثة",
  sentiment: "تحليل مشاعر",
  smart_search: "بحث ذكي",
};

interface AIData {
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  prevMonthCost: number;
  prevMonthRequests: number;
  avgDuration: number;
  byFeature: Record<string, { requests: number; inputTokens: number; outputTokens: number; avgDuration: number }>;
  daily: { date: string; requests: number; tokens: number; cost: number }[];
}

interface SalesData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  statusBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  daily: { date: string; revenue: number; orders: number }[];
  prevRevenue?: number;
  prevOrders?: number;
  revenueChange?: number;
  ordersChange?: number;
}

interface BotData {
  totalConversations: number;
  totalHandoffs: number;
  totalStoreClicks: number;
  avgCsat: number;
  daily: { date: string; conversations: number; messages: number; handoffs: number }[];
  prevConversations?: number;
  prevHandoffs?: number;
  convChange?: number;
  handoffChange?: number;
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"sales" | "ai" | "bot">("sales");
  const [days, setDays] = useState(30);
  const [ai, setAi] = useState<AIData | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [bot, setBot] = useState<BotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/ai-usage").then((r) => r.json()),
      fetch(`/api/admin/analytics?days=${days}`).then((r) => r.json()),
    ])
      .then(([aiRes, analyticsRes]) => {
        if (aiRes.success) setAi(aiRes.data);
        if (analyticsRes.success) {
          setSales(analyticsRes.data.sales);
          setBot(analyticsRes.data.bot);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const tabs = [
    { key: "sales", label: "💰 المبيعات" },
    { key: "ai", label: "🤖 الذكاء الاصطناعي" },
    { key: "bot", label: "💬 البوت" },
  ];

  return (
    <div className="p-4 desktop:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-black">📊 التحليلات والتقارير</h1>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-chip text-xs font-bold transition-colors"
              style={{
                background: days === d ? "rgba(196,16,64,0.15)" : "transparent",
                color: days === d ? "#c41040" : "#71717a",
                border: `1px solid ${days === d ? "#c41040" : "#27272a"}`,
              }}
            >
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-surface-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className="px-4 py-2 rounded-t-lg text-sm font-bold transition-colors"
            style={{
              background: tab === t.key ? "rgba(196,16,64,0.1)" : "transparent",
              color: tab === t.key ? "#c41040" : "#71717a",
              borderBottom: tab === t.key ? "2px solid #c41040" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted">جاري التحميل...</div>
      ) : (
        <>
          {tab === "sales" && sales && <SalesTab data={sales} />}
          {tab === "ai" && ai && <AITab data={ai} />}
          {tab === "bot" && bot && <BotTab data={bot} />}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, change }: { label: string; value: string | number; sub?: string; change?: number }) {
  return (
    <div className="bg-surface-card rounded-card border border-surface-border p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-[10px] text-muted mt-1">{sub}</p>}
      {change !== undefined && change !== 0 && (
        <p className={`text-[10px] mt-1 font-bold ${change > 0 ? "text-green-400" : "text-red-400"}`}>
          {change > 0 ? "↑" : "↓"} {Math.abs(change)}% عن الفترة السابقة
        </p>
      )}
    </div>
  );
}

function BarChart({ data, valueKey, label, color = "#c41040", maxBars = 30 }: {
  data: { date: string; [key: string]: any }[];
  valueKey: string;
  label: string;
  color?: string;
  maxBars?: number;
}) {
  const sliced = data.slice(-maxBars);
  if (sliced.length === 0) return <p className="text-xs text-dim py-4">لا توجد بيانات</p>;
  const max = Math.max(...sliced.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted">{label}</p>
      <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
        {sliced.map((d, i) => {
          const val = d[valueKey] || 0;
          const h = Math.max((val / max) * 100, 2);
          return (
            <div
              key={d.date || i}
              className="flex-1 rounded-t-sm transition-all hover:opacity-80 group relative"
              style={{ height: `${h}%`, background: color, minWidth: 4 }}
              title={`${d.date}: ${typeof val === "number" && val > 100 ? val.toLocaleString() : val}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-dim">
        <span>{sliced[0]?.date?.split("-").slice(1).join("/")}</span>
        <span>{sliced[sliced.length - 1]?.date?.split("-").slice(1).join("/")}</span>
      </div>
    </div>
  );
}

function BreakdownBars({ data, total }: { data: Record<string, number>; total: number }) {
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a);
  const colors = ["#c41040", "#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];
  return (
    <div className="space-y-2">
      {sorted.map(([key, count], i) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted">{key}</span>
              <span className="font-bold">{count} ({Math.round(pct)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SalesTab({ data }: { data: SalesData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3">
        <StatCard label="الإيرادات" value={`₪${data.totalRevenue.toLocaleString()}`} change={data.revenueChange} sub={data.prevRevenue != null ? `الفترة السابقة: ₪${data.prevRevenue.toLocaleString()}` : undefined} />
        <StatCard label="الطلبات" value={data.totalOrders} change={data.ordersChange} sub={data.prevOrders != null ? `الفترة السابقة: ${data.prevOrders}` : undefined} />
        <StatCard label="متوسط الطلب" value={`₪${data.avgOrderValue.toLocaleString()}`} />
        <StatCard
          label="معدل يومي"
          value={`₪${data.daily.length > 0 ? Math.round(data.totalRevenue / data.daily.length).toLocaleString() : 0}`}
        />
      </div>

      <div className="bg-surface-card rounded-card border border-surface-border p-4">
        <BarChart data={data.daily} valueKey="revenue" label="📈 الإيرادات اليومية (₪)" />
      </div>

      <div className="bg-surface-card rounded-card border border-surface-border p-4">
        <BarChart data={data.daily} valueKey="orders" label="📦 الطلبات اليومية" color="#6366f1" />
      </div>

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        <div className="bg-surface-card rounded-card border border-surface-border p-4">
          <p className="text-xs font-bold text-muted mb-3">حالة الطلبات</p>
          <BreakdownBars data={data.statusBreakdown} total={data.totalOrders} />
        </div>
        <div className="bg-surface-card rounded-card border border-surface-border p-4">
          <p className="text-xs font-bold text-muted mb-3">مصادر الطلبات</p>
          <BreakdownBars data={data.sourceBreakdown} total={data.totalOrders} />
        </div>
      </div>
    </div>
  );
}

function AITab({ data }: { data: AIData }) {
  const features = Object.entries(data.byFeature).sort(([, a], [, b]) => b.requests - a.requests);
  const costChange = data.prevMonthCost > 0
    ? Math.round(((data.estimatedCost - data.prevMonthCost) / data.prevMonthCost) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3">
        <StatCard label="الطلبات هذا الشهر" value={data.totalRequests.toLocaleString()} sub={`الشهر الماضي: ${data.prevMonthRequests}`} />
        <StatCard label="التوكنات" value={(data.totalTokens / 1000).toFixed(1) + "K"} />
        <StatCard
          label="التكلفة التقديرية"
          value={`$${data.estimatedCost}`}
          sub={costChange !== 0 ? `${costChange > 0 ? "+" : ""}${costChange}% عن الشهر الماضي` : undefined}
        />
        <StatCard label="متوسط الاستجابة" value={`${data.avgDuration}ms`} />
      </div>

      <div className="bg-surface-card rounded-card border border-surface-border p-4">
        <BarChart data={data.daily} valueKey="requests" label="📊 الطلبات اليومية" color="#8b5cf6" />
      </div>

      <div className="bg-surface-card rounded-card border border-surface-border p-4">
        <p className="text-xs font-bold text-muted mb-3">استخدام حسب الميزة</p>
        <div className="space-y-3">
          {features.map(([key, val]) => {
            const pct = data.totalRequests > 0 ? (val.requests / data.totalRequests) * 100 : 0;
            const cost = ((val.inputTokens / 1_000_000) * 3 + (val.outputTokens / 1_000_000) * 15).toFixed(2);
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold">{FEATURE_LABELS[key] || key}</span>
                  <span className="text-muted">{val.requests} طلب · ${cost} · {val.avgDuration}ms</span>
                </div>
                <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BotTab({ data }: { data: BotData }) {
  const handoffRate = data.totalConversations > 0
    ? Math.round((data.totalHandoffs / data.totalConversations) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3">
        <StatCard label="المحادثات" value={data.totalConversations.toLocaleString()} change={data.convChange} sub={data.prevConversations != null ? `الفترة السابقة: ${data.prevConversations}` : undefined} />
        <StatCard label="التصعيدات" value={data.totalHandoffs} change={data.handoffChange} sub={`${handoffRate}% من المحادثات`} />
        <StatCard label="نقرات المتجر" value={data.totalStoreClicks} />
        <StatCard label="تقييم CSAT" value={data.avgCsat > 0 ? `${data.avgCsat}/5` : "—"} />
      </div>

      <div className="bg-surface-card rounded-card border border-surface-border p-4">
        <BarChart data={data.daily} valueKey="conversations" label="💬 المحادثات اليومية" color="#10b981" />
      </div>

      <div className="bg-surface-card rounded-card border border-surface-border p-4">
        <BarChart data={data.daily} valueKey="handoffs" label="🔔 التصعيدات اليومية" color="#ef4444" />
      </div>
    </div>
  );
}
