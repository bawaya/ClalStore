"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  Target,
  Trophy,
  Bell,
  ActivitySquare,
  ArrowLeft,
} from "lucide-react";
import { formatCurrency, timeAgo } from "@/lib/utils";

type DashboardData = {
  today: { date: string; salesCount: number; totalAmount: number; commission: number };
  month: {
    month: string;
    salesCount: number;
    totalAmount: number;
    // New sales-focused fields (optional — older API responses may omit them)
    totalLineSalesAmount?: number;
    totalDeviceSalesAmount?: number;
    autoTrackedDeviceSales?: number;
    manualSalesAddOn?: number;
    manualAddOnDeviceCommission?: number;
    totalCommission: number;
    sanctions: number;
    netCommission: number;
    targetSalesAmount?: number;
    salesProgress?: number;
    salesRemaining?: number;
    salesRequiredPerDay?: number;
    salesPerDayPace?: number;
    targetCommissionAmount?: number;
    commissionProgress?: number;
    commissionRemaining?: number;
    commissionRequiredPerDay?: number;
    workingDaysElapsed?: number;
    totalWorkingDays?: number;
    // Legacy/core (always present)
    workingDaysLeft: number;
    target: number;
    targetProgress: number;
    remainingAmount: number;
    dailyRequired: number;
    pacingColor: "green" | "yellow" | "red";
  };
  milestones: {
    currentTotal: number;
    nextMilestoneAt: number;
    milestonesReached: number;
    bonusEarned: number;
  };
  recentSales: Array<{
    id: number;
    sale_date: string;
    sale_type: "line" | "device";
    package_price: number | null;
    device_sale_amount: number | null;
    commission_amount: number;
    source: string;
  }>;
};

type Activity = {
  id: number;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
};

function formatTodayDate(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function sourceBadge(source: string): { label: string; cls: string } {
  switch (source) {
    case "pipeline":
      return { label: "Pipeline", cls: "bg-violet-500/15 text-violet-200" };
    case "sales_doc":
    case "pwa":
      return { label: "PWA", cls: "bg-emerald-500/15 text-emerald-200" };
    case "manual":
      return { label: "يدوي", cls: "bg-slate-500/15 text-slate-200" };
    case "auto_sync":
      return { label: "Sync", cls: "bg-sky-500/15 text-sky-200" };
    case "order":
      return { label: "طلب", cls: "bg-amber-500/15 text-amber-200" };
    default:
      return { label: source, cls: "bg-white/10 text-slate-200" };
  }
}

function pacingColors(color: "green" | "yellow" | "red"): {
  bar: string;
  text: string;
} {
  if (color === "green") return { bar: "bg-emerald-500", text: "text-emerald-300" };
  if (color === "yellow") return { bar: "bg-amber-500", text: "text-amber-300" };
  return { bar: "bg-rose-500", text: "text-rose-300" };
}

export default function SalesPwaDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [unread, setUnread] = useState(0);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [dashRes, annRes, actRes] = await Promise.all([
          fetch("/api/employee/commissions/dashboard", { credentials: "same-origin" }),
          fetch("/api/employee/announcements", { credentials: "same-origin" }),
          fetch("/api/employee/activity?limit=3&offset=0", { credentials: "same-origin" }),
        ]);
        if (cancelled) return;

        const dashJson: unknown = await dashRes.json().catch(() => ({}));
        if (!dashRes.ok) {
          const msg =
            (dashJson as { error?: string } | undefined)?.error || "فشل في تحميل اللوحة";
          throw new Error(msg);
        }
        // apiSuccess spreads keys at top level
        setData(dashJson as DashboardData);

        const annJson: unknown = await annRes.json().catch(() => ({}));
        if (annRes.ok && annJson && typeof annJson === "object" && "unreadCount" in annJson) {
          const n = (annJson as { unreadCount?: number }).unreadCount;
          if (typeof n === "number") setUnread(n);
        }

        const actJson: unknown = await actRes.json().catch(() => ({}));
        if (actRes.ok && actJson && typeof actJson === "object" && "activities" in actJson) {
          const list = (actJson as { activities?: Activity[] }).activities;
          if (Array.isArray(list)) setActivity(list);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطأ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        {error || "تعذر تحميل اللوحة"}
      </div>
    );
  }

  const pacing = pacingColors(data.month.pacingColor);
  const pct = Math.min(100, data.month.targetProgress);
  const msPct =
    data.milestones.nextMilestoneAt > 0
      ? Math.min(100, (data.milestones.currentTotal / data.milestones.nextMilestoneAt) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Top card — today */}
      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-300">{formatTodayDate(data.today.date)}</div>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="text-3xl font-black md:text-4xl">{data.today.salesCount}</div>
              <div className="text-sm text-slate-300">مبيعات اليوم</div>
            </div>
            <div className="mt-1 text-sm text-slate-300">
              إجمالي: <span className="font-bold text-white">{formatCurrency(data.today.totalAmount)}</span>
            </div>
            <div className="mt-1 text-sm text-emerald-300">
              عمولة اليوم: <span className="font-black">{formatCurrency(data.today.commission)}</span>
            </div>
          </div>
          <Link
            href="/sales-pwa/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
          >
            <Plus className="h-5 w-5" aria-hidden />
            بيعة جديدة
          </Link>
        </div>
      </section>

      {/* Target card — sales-focused to match admin dashboard */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-sky-300" aria-hidden />
            <div className="text-sm font-bold">الهدف الشهري · יעד חודשי</div>
          </div>
          <div className={`text-sm font-black ${pacing.text}`}>{pct}%</div>
        </div>

        {/* Primary label — MBY'AT (sales) when sales target exists, else commission */}
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-100">
            {(data.month.targetSalesAmount ?? 0) > 0
              ? `مبيعات: ${formatCurrency(data.month.totalAmount)} / ${formatCurrency(data.month.targetSalesAmount ?? 0)}`
              : `عمولات: ${formatCurrency(data.month.netCommission)} / ${formatCurrency(data.month.targetCommissionAmount ?? data.month.target ?? 0)}`}
          </span>
          {(data.month.manualSalesAddOn ?? 0) > 0 && (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
              +{formatCurrency(data.month.manualSalesAddOn ?? 0)} إضافة يدوية (أجهزة)
            </span>
          )}
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full ${pacing.bar} transition-all`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Gap highlight — SALES remaining + SALES required per day (matches
            the admin page's two-card box exactly). */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={`rounded-xl border p-3 ${
            data.month.pacingColor === "green"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : data.month.pacingColor === "yellow"
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-rose-500/30 bg-rose-500/10"
          }`}>
            <div className="text-[10px] font-semibold text-slate-200">💸 المتبقي (كل الشهر)</div>
            <div className={`mt-1 text-lg font-black ${pacing.text}`}>
              {data.month.remainingAmount <= 0
                ? "✅ تم"
                : formatCurrency(data.month.remainingAmount)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-300">
              {data.month.targetSalesAmount > 0 ? "مبيعات متبقية" : "عمولات متبقية"}
            </div>
          </div>
          <div className={`rounded-xl border p-3 ${
            data.month.pacingColor === "green"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : data.month.pacingColor === "yellow"
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-rose-500/30 bg-rose-500/10"
          }`}>
            <div className="text-[10px] font-semibold text-slate-200">📈 مطلوب يومياً</div>
            <div className={`mt-1 text-lg font-black ${pacing.text}`}>
              {data.month.remainingAmount <= 0
                ? "—"
                : formatCurrency(data.month.dailyRequired)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-300">
              لـ{data.month.workingDaysLeft} أيام عمل
            </div>
          </div>
        </div>

        {/* Secondary info row */}
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
          <div>
            <div className="text-[10px] text-slate-400">صافي عمولات الشهر</div>
            <div className="text-sm font-bold text-emerald-300">
              {formatCurrency(data.month.netCommission)}
            </div>
            {(data.month.manualAddOnDeviceCommission ?? 0) > 0 && (
              <div className="text-[9px] text-slate-400">
                منها {formatCurrency(data.month.manualAddOnDeviceCommission ?? 0)} من الإضافة اليدوية
              </div>
            )}
          </div>
          {(data.month.targetSalesAmount ?? 0) > 0 && (data.month.targetCommissionAmount ?? 0) > 0 && (
            <div>
              <div className="text-[10px] text-slate-400">هدف العمولات</div>
              <div className="text-sm font-bold">
                {formatCurrency(data.month.netCommission)} / {formatCurrency(data.month.targetCommissionAmount ?? 0)}
              </div>
              <div className="text-[9px] text-slate-400">
                {data.month.commissionProgress ?? 0}% — {formatCurrency(data.month.commissionRequiredPerDay ?? 0)}/يوم
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Milestones card */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" aria-hidden />
            <div className="text-sm font-bold">المعالم · אבני דרך</div>
          </div>
          <div className="text-xs text-slate-400">{formatCurrency(data.milestones.currentTotal)}</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${msPct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(msPct)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <span>
            المعلم التالي: <span className="font-bold text-white">{formatCurrency(data.milestones.nextMilestoneAt)}</span>
          </span>
          <span>
            هذا الشهر: <span className="font-bold text-amber-300">{data.milestones.milestonesReached} معالم</span>
            <span className="mx-1 text-slate-500">·</span>
            <span className="font-bold text-emerald-300">بونص {formatCurrency(data.milestones.bonusEarned)}</span>
          </span>
        </div>
      </section>

      {/* Recent sales */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-300" aria-hidden />
            <div className="text-sm font-bold">آخر المبيعات</div>
          </div>
          <Link href="/sales-pwa/commissions" className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200">
            عرض الكل <ArrowLeft className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        {data.recentSales.length === 0 ? (
          <div className="text-sm text-slate-400">لا توجد مبيعات حتى الآن هذا الشهر</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.recentSales.map((s) => {
              const amount =
                s.sale_type === "line"
                  ? Number(s.package_price || 0)
                  : Number(s.device_sale_amount || 0);
              const badge = sourceBadge(s.source);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{s.sale_date}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                        {s.sale_type === "line" ? "خط" : "جهاز"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm font-bold">{formatCurrency(amount)}</div>
                  </div>
                  <div className="text-sm font-black text-emerald-300">
                    +{formatCurrency(s.commission_amount)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Unread announcements */}
      {unread > 0 && (
        <Link
          href="/sales-pwa/announcements"
          className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 hover:bg-rose-500/15"
        >
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-rose-300" aria-hidden />
            <div>
              <div className="text-sm font-bold">لديك {unread} إعلانات غير مقروءة</div>
              <div className="text-[11px] text-slate-300">اضغط للعرض</div>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-rose-200" aria-hidden />
        </Link>
      )}

      {/* Last 3 activity */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ActivitySquare className="h-4 w-4 text-violet-300" aria-hidden />
            <div className="text-sm font-bold">النشاط الأخير</div>
          </div>
          <Link href="/sales-pwa/activity" className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200">
            كامل السجل <ArrowLeft className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="text-sm text-slate-400">لا يوجد نشاط</div>
        ) : (
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                <div className="text-xs text-slate-400">{timeAgo(a.created_at)}</div>
                <div className="text-sm font-bold">{a.title}</div>
                {a.description && <div className="mt-0.5 text-xs text-slate-300">{a.description}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
