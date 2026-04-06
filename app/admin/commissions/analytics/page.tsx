"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { StatCard, ToastContainer } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";

interface MonthlyData {
  month: string;
  targetTotal: number;
  linesCommission: number;
  devicesCommission: number;
  loyaltyBonus: number;
  grossCommission: number;
  totalSanctions: number;
  netCommission: number;
  targetProgress: number;
  linesSalesCount: number;
  devicesSalesCount: number;
  totalSalesCount: number;
}

interface QuarterlyData {
  label: string;
  netCommission: number;
  targetTotal: number;
  targetProgress: number;
  salesCount: number;
  sanctions: number;
}

interface KPI {
  totalCommissions: number;
  avgTargetAchievement: number;
  bestMonth: { month: string; amount: number } | null;
  totalSalesCount: number;
  totalSanctions: number;
  totalLoyaltyBonuses: number;
}

interface AnalyticsData {
  monthly: MonthlyData[];
  quarterly: QuarterlyData[];
  kpi: KPI;
}

function hebrewMonth(month: string): string {
  const months: Record<string, string> = {
    "01": "ינואר", "02": "פברואר", "03": "מרץ", "04": "אפריל",
    "05": "מאי", "06": "יוני", "07": "יולי", "08": "אוגוסט",
    "09": "ספטמבר", "10": "אוקטובר", "11": "נובמבר", "12": "דצמבר",
  };
  const [y, m] = month.split("-");
  return `${months[m] || m} ${y}`;
}

export default function AnalyticsPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeMonths, setRangeMonths] = useState(12);
  const [view, setView] = useState<"table" | "cards" | "quarterly">("table");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/commissions/analytics?months=${rangeMonths}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data || json);
    } catch {
      show("שגיאה בטעינת הנתונים", "error");
    } finally {
      setLoading(false);
    }
  }, [rangeMonths, show]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) return <div className="text-center py-20 text-muted" dir="rtl">טוען נתונים...</div>;
  if (!data) return null;

  const progressColor = (pct: number) =>
    pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>📈 ניתוח עמלות</h1>
        <div className="flex items-center gap-2">
          <select
            value={rangeMonths}
            onChange={(e) => setRangeMonths(parseInt(e.target.value))}
            className="input"
            style={{ width: scr.mobile ? 100 : 130, fontSize: 12, padding: "6px 10px" }}
          >
            <option value={6}>6 חודשים</option>
            <option value={12}>12 חודשים</option>
            <option value={24}>24 חודשים</option>
          </select>
          <Link href="/admin/commissions" className="chip">← חזור</Link>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip chip-active">ניתוח</Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
        <StatCard icon="💰" label="סה״כ עמלות" value={formatCurrency(data.kpi.totalCommissions)} color="#22c55e" />
        <StatCard icon="🎯" label="ממוצע השגת יעד" value={`${data.kpi.avgTargetAchievement}%`} color="#3b82f6" />
        <StatCard
          icon="🏆"
          label="חודש הכי טוב"
          value={data.kpi.bestMonth ? formatCurrency(data.kpi.bestMonth.amount) : "—"}
          sub={data.kpi.bestMonth ? hebrewMonth(data.kpi.bestMonth.month) : undefined}
          color="#f97316"
        />
        <StatCard icon="🛒" label="סה״כ מכירות" value={String(data.kpi.totalSalesCount)} color="#8b5cf6" />
        <StatCard icon="⚠️" label="סה״כ סנקציות" value={formatCurrency(data.kpi.totalSanctions)} color="#ef4444" />
        <StatCard icon="🤝" label="סה״כ בונוסי נאמנות" value={formatCurrency(data.kpi.totalLoyaltyBonuses)} color="#06b6d4" />
      </div>

      {/* View Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-surface-border mb-4">
        {([
          { key: "table" as const, label: "טבלה" },
          { key: "cards" as const, label: "כרטיסים" },
          { key: "quarterly" as const, label: "רבעוני" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className="flex-1 transition-colors border-0 cursor-pointer"
            style={{
              padding: scr.mobile ? "8px 4px" : "10px 16px",
              fontSize: scr.mobile ? 10 : 12,
              fontWeight: view === t.key ? 700 : 400,
              background: view === t.key ? "#c41040" : "transparent",
              color: view === t.key ? "#fff" : "#a1a1aa",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table View */}
      {view === "table" && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 8 : 18 }}>
          <h3 className="font-bold mb-3 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>השוואה חודשית</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ fontSize: scr.mobile ? 9 : 12 }}>
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-2 px-1 font-semibold">%</th>
                  <th className="py-2 px-1 font-semibold">נטו</th>
                  <th className="py-2 px-1 font-semibold">סנקציות</th>
                  <th className="py-2 px-1 font-semibold">מכשירים</th>
                  <th className="py-2 px-1 font-semibold">קווים</th>
                  <th className="py-2 px-1 font-semibold">יעד</th>
                  <th className="py-2 px-1 font-semibold">חודש</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-surface-border/50">
                    <td className="py-2 px-1">
                      <span
                        className="font-bold text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          color: progressColor(m.targetProgress),
                          background: `${progressColor(m.targetProgress)}15`,
                        }}
                      >
                        {m.targetProgress}%
                      </span>
                    </td>
                    <td className="py-2 px-1 font-bold" style={{ color: "#22c55e" }}>{formatCurrency(m.netCommission)}</td>
                    <td className="py-2 px-1" style={{ color: m.totalSanctions > 0 ? "#ef4444" : "#71717a" }}>
                      {m.totalSanctions > 0 ? `-${formatCurrency(m.totalSanctions)}` : "—"}
                    </td>
                    <td className="py-2 px-1">{m.devicesSalesCount} ({formatCurrency(m.devicesCommission)})</td>
                    <td className="py-2 px-1">{m.linesSalesCount} ({formatCurrency(m.linesCommission)})</td>
                    <td className="py-2 px-1">{m.targetTotal > 0 ? formatCurrency(m.targetTotal) : "—"}</td>
                    <td className="py-2 px-1 font-bold">{hebrewMonth(m.month)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards View */}
      {view === "cards" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          {data.monthly.map((m) => (
            <div key={m.month} className="card" style={{ padding: scr.mobile ? 12 : 18 }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded"
                  style={{
                    color: progressColor(m.targetProgress),
                    background: `${progressColor(m.targetProgress)}15`,
                  }}
                >
                  {m.targetProgress}%
                </span>
                <h4 className="font-bold" style={{ fontSize: 13 }}>{hebrewMonth(m.month)}</h4>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, m.targetProgress)}%`,
                    background: progressColor(m.targetProgress),
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="text-right">
                  <span className="text-muted">יעד: </span>
                  <span className="font-bold">{m.targetTotal > 0 ? formatCurrency(m.targetTotal) : "—"}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted">נטו: </span>
                  <span className="font-bold" style={{ color: "#22c55e" }}>{formatCurrency(m.netCommission)}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted">קווים: </span>
                  <span className="font-bold">{m.linesSalesCount}</span>
                  <span className="text-dim"> ({formatCurrency(m.linesCommission)})</span>
                </div>
                <div className="text-right">
                  <span className="text-muted">מכשירים: </span>
                  <span className="font-bold">{m.devicesSalesCount}</span>
                  <span className="text-dim"> ({formatCurrency(m.devicesCommission)})</span>
                </div>
                <div className="text-right">
                  <span className="text-muted">סנקציות: </span>
                  <span className="font-bold" style={{ color: m.totalSanctions > 0 ? "#ef4444" : "#71717a" }}>
                    {m.totalSanctions > 0 ? formatCurrency(m.totalSanctions) : "—"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted">נאמנות: </span>
                  <span className="font-bold" style={{ color: "#06b6d4" }}>{formatCurrency(m.loyaltyBonus)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quarterly View */}
      {view === "quarterly" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
          {data.quarterly.map((q) => (
            <div key={q.label} className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-bold text-xs px-2 py-1 rounded"
                  style={{
                    color: progressColor(q.targetProgress),
                    background: `${progressColor(q.targetProgress)}15`,
                  }}
                >
                  {q.targetProgress}%
                </span>
                <h4 className="font-black" style={{ fontSize: 16 }}>{q.label}</h4>
              </div>

              {/* Progress bar */}
              <div className="w-full h-4 bg-surface-elevated rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, q.targetProgress)}%`,
                    background: progressColor(q.targetProgress),
                  }}
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: "#22c55e" }}>{formatCurrency(q.netCommission)}</span>
                  <span className="text-muted">עמלות נטו</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">{q.targetTotal > 0 ? formatCurrency(q.targetTotal) : "—"}</span>
                  <span className="text-muted">יעד רבעוני</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">{q.salesCount}</span>
                  <span className="text-muted">מכירות</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: q.sanctions > 0 ? "#ef4444" : "#71717a" }}>
                    {q.sanctions > 0 ? formatCurrency(q.sanctions) : "—"}
                  </span>
                  <span className="text-muted">סנקציות</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
