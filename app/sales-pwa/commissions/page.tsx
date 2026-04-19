"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Download,
  Smartphone,
  Phone,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { COMMISSION_LABELS } from "@/app/sales-pwa/_shared/labels";

type SaleRow = {
  id: number;
  date: string;
  type: "line" | "device";
  amount: number;
  source: string;
  commission: {
    contractAmount: number;
    employeeAmount: number;
    ownerProfit: number;
    calculation: string;
  };
  customer: string | null;
  phone: string | null;
  deviceName: string | null;
  status: string;
};

type Sanction = {
  id: number;
  sanction_date: string;
  sanction_type: string;
  amount: number;
  description: string | null;
  has_sale_offset: boolean | null;
};

type Milestone = { threshold: number; hit_on: string; bonus: number };

type CommissionsSummary = {
  totalLineSalesAmount: number;
  autoTrackedDeviceSales: number;
  manualSalesAddOn: number;
  totalDeviceSalesAmount: number;
  totalSalesAmount: number;
  linesCommission: number;
  autoDevicesCommission: number;
  manualAddOnDeviceCommission: number;
  devicesCommission: number;
  sanctionsTotal: number;
  grossCommission: number;
  netCommission: number;
  targetSalesAmount: number;
  targetCommissionAmount: number;
  salesProgress: number;
  salesRemaining: number;
  salesRequiredPerDay: number;
  commissionProgress: number;
  commissionRemaining: number;
  commissionRequiredPerDay: number;
  workingDaysLeft: number;
  workingDaysElapsed: number;
  totalWorkingDays: number;
};

type DetailsPayload = {
  month: string;
  scope?: "admin" | "employee";
  sales: SaleRow[];
  sanctions: Sanction[];
  milestones: Milestone[];
  summary?: CommissionsSummary;
};

type ChartPayload = {
  months: string[];
  sales: number[];
  commissions: number[];
  targets: number[];
};

function currentMonthIL(): string {
  const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
}

function last12Months(): string[] {
  const out: string[] = [];
  const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  for (let i = 0; i < 12; i++) {
    const d = new Date(nowIL.getFullYear(), nowIL.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split("-").map((n) => parseInt(n, 10));
  const d = new Date(y, (mo - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sourceBadge(source: string): { label: string; cls: string } {
  switch (source) {
    case "pipeline":
      return { label: "Pipeline", cls: "bg-violet-500/15 text-violet-200" };
    case "sales_doc":
    case "pwa":
      return { label: "PWA", cls: "bg-emerald-500/15 text-emerald-200" };
    case "manual":
      return { label: "يدوي", cls: "bg-slate-500/20 text-slate-200" };
    case "auto_sync":
      return { label: "Sync", cls: "bg-sky-500/15 text-sky-200" };
    case "order":
      return { label: "طلب", cls: "bg-amber-500/15 text-amber-200" };
    case "csv_import":
      return { label: "CSV", cls: "bg-slate-500/15 text-slate-200" };
    default:
      return { label: source, cls: "bg-white/10 text-slate-200" };
  }
}

export default function CommissionsDetailsPage() {
  const [month, setMonth] = useState<string>(currentMonthIL());
  const [details, setDetails] = useState<DetailsPayload | null>(null);
  const [chart, setChart] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showSales, setShowSales] = useState(true);
  const [showCommissions, setShowCommissions] = useState(true);
  const [showTargets, setShowTargets] = useState(true);

  const months = useMemo(() => last12Months(), []);

  const fetchAll = useCallback(async (m: string) => {
    setLoading(true);
    setError("");
    try {
      const [dRes, cRes] = await Promise.all([
        fetch(`/api/employee/commissions/details?month=${encodeURIComponent(m)}`, {
          credentials: "same-origin",
        }),
        fetch(`/api/employee/commissions/chart?range=12months`, {
          credentials: "same-origin",
        }),
      ]);
      const dJson: unknown = await dRes.json().catch(() => ({}));
      const cJson: unknown = await cRes.json().catch(() => ({}));
      if (!dRes.ok) {
        throw new Error((dJson as { error?: string } | undefined)?.error || "فشل تحميل التفاصيل");
      }
      setDetails(dJson as DetailsPayload);
      if (cRes.ok) setChart(cJson as ChartPayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(month);
  }, [month, fetchAll]);

  // Derived totals — prefer server-computed summary (matches admin view
  // exactly, incl. manual add-on folded in). Falls back to client-side
  // aggregation for older API responses.
  const totals = useMemo(() => {
    if (!details) return null;
    if (details.summary) {
      const s = details.summary;
      return {
        linesTotal: s.linesCommission,
        devicesTotal: s.autoDevicesCommission,
        loyalty: 0,
        milestoneBonus: details.milestones.reduce((sum, m) => sum + m.bonus, 0),
        sanctionsTotal: s.sanctionsTotal,
        manualAddOnDeviceCommission: s.manualAddOnDeviceCommission,
        net: s.netCommission,
      };
    }
    let linesTotal = 0;
    let devicesTotal = 0;
    for (const s of details.sales) {
      if (s.type === "line") linesTotal += s.commission.employeeAmount;
      else devicesTotal += s.commission.employeeAmount;
    }
    const milestoneBonus = details.milestones.reduce((sum, m) => sum + m.bonus, 0);
    const sanctionsTotal = details.sanctions.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const loyalty = 0;
    const gross = linesTotal + devicesTotal + milestoneBonus + loyalty;
    const net = gross - sanctionsTotal;
    return {
      linesTotal,
      devicesTotal,
      loyalty,
      milestoneBonus,
      sanctionsTotal,
      manualAddOnDeviceCommission: 0,
      net,
    };
  }, [details]);

  const chartData = useMemo(() => {
    if (!chart) return [];
    return chart.months.map((m, i) => ({
      month: m,
      sales: chart.sales[i] || 0,
      commissions: chart.commissions[i] || 0,
      targets: chart.targets[i] || 0,
    }));
  }, [chart]);

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <section className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        <button
          type="button"
          aria-label="الشهر السابق"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <label className="flex-1 text-center">
          <span className="sr-only">اختيار الشهر</span>
          <select
            aria-label="اختيار الشهر"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-center text-sm font-bold"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="الشهر التالي"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <a
          href={`/api/employee/commissions/export?month=${encodeURIComponent(month)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30"
        >
          <Download className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">تحميل PDF</span>
        </a>
      </section>

      {loading && <div className="text-sm text-slate-400">جاري التحميل…</div>}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && details && totals && (
        <>
          {/* Sales hero — matches admin dashboard. Only shown when API
              returned the server-computed summary. */}
          {details.summary && (
            <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-5">
              <div className="mb-3 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold">💰 إجمالي المبيعات</div>
                  {details.scope === "admin" && (
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                      العقد
                    </span>
                  )}
                </div>
                <div className="text-3xl font-black text-emerald-300 md:text-4xl">
                  {formatCurrency(details.summary.totalSalesAmount)}
                </div>
              </div>
              {details.summary.targetSalesAmount > 0 && (
                <>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-100">{details.summary.salesProgress}%</span>
                    <span className="font-semibold text-slate-200">
                      {formatCurrency(details.summary.totalSalesAmount)} / {formatCurrency(details.summary.targetSalesAmount)}
                    </span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all ${
                        details.summary.salesProgress >= 80
                          ? "bg-emerald-500"
                          : details.summary.salesProgress >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, details.summary.salesProgress)}%` }}
                    />
                  </div>
                  {/* Sales gap — only meaningful when a sales target is set;
                      when reached (remaining <= 0 AND target > 0) show ✅. */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                      <div className="text-[10px] font-semibold text-slate-300">💸 المتبقي للهدف</div>
                      <div className="mt-1 text-lg font-black text-slate-100">
                        {details.summary.salesRemaining > 0
                          ? formatCurrency(details.summary.salesRemaining)
                          : "✅ تم"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                      <div className="text-[10px] font-semibold text-slate-300">📈 مبيعات يومياً</div>
                      <div className="mt-1 text-lg font-black text-slate-100">
                        {details.summary.salesRemaining > 0
                          ? formatCurrency(details.summary.salesRequiredPerDay)
                          : "—"}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        لـ{details.summary.workingDaysLeft} أيام عمل
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* Breakdown */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                  <div className="text-[10px] font-semibold text-slate-200">📡 مبيعات خطوط</div>
                  <div className="mt-1 text-base font-black text-sky-300">
                    {formatCurrency(details.summary.totalLineSalesAmount)}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                  <div className="text-[10px] font-semibold text-slate-200">📱 مبيعات أجهزة</div>
                  <div className="mt-1 text-base font-black text-rose-300">
                    {formatCurrency(details.summary.totalDeviceSalesAmount)}
                  </div>
                  {details.summary.manualSalesAddOn > 0 && (
                    <div className="mt-1 flex items-center justify-between rounded-md bg-rose-500/15 px-1.5 py-1">
                      <span className="text-[9px] font-bold text-rose-200">
                        +{formatCurrency(details.summary.manualAddOnDeviceCommission)} عمولة
                      </span>
                      <span className="text-[9px] font-semibold text-slate-100">
                        +{formatCurrency(details.summary.manualSalesAddOn)} يدوي
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Commission summary section. Device milestone bonuses are
              already baked into `devicesTotal` by the ledger allocator, so
              they are NOT shown as a separate additive cell here (pre-existing
              bug: that double-counted them). Milestones are listed below in
              their own dedicated section. */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-3 text-sm font-bold">{COMMISSION_LABELS.summary}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCell label="عمولة خطوط" value={totals.linesTotal} color="sky" />
              <SummaryCell
                label="عمولة أجهزة"
                value={totals.devicesTotal + (totals.manualAddOnDeviceCommission || 0)}
                color="rose"
                sub={totals.manualAddOnDeviceCommission > 0
                  ? `منها ${formatCurrency(totals.manualAddOnDeviceCommission)} يدوي`
                  : undefined}
              />
              <SummaryCell label="ولاء" value={totals.loyalty} color="violet" />
              <SummaryCell
                label="عقوبات"
                value={-totals.sanctionsTotal}
                color={totals.sanctionsTotal > 0 ? "rose" : "slate"}
              />
            </div>
            <div className="mt-4 flex items-baseline justify-between rounded-xl bg-slate-950/70 p-4">
              <div className="text-sm font-bold">الصافي · נטו</div>
              <div
                className={`text-2xl font-black md:text-3xl ${
                  totals.net >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {formatCurrency(totals.net)}
              </div>
            </div>
          </section>

          {/* Sales table */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold">المبيعات ({details.sales.length})</div>
            </div>
            {details.sales.length === 0 ? (
              <div className="text-sm text-slate-400">لا توجد مبيعات هذا الشهر</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 font-semibold">التاريخ</th>
                      <th className="py-2 font-semibold">نوع</th>
                      <th className="py-2 font-semibold">العميل</th>
                      <th className="py-2 font-semibold">المبلغ</th>
                      <th className="py-2 font-semibold">العمولة</th>
                      <th className="py-2 font-semibold">المصدر</th>
                      <th className="py-2 font-semibold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.sales.map((s) => {
                      const badge = sourceBadge(s.source);
                      const isExp = expanded === s.id;
                      return (
                        <Fragment key={s.id}>
                          <tr
                            onClick={() => setExpanded(isExp ? null : s.id)}
                            className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                          >
                            <td className="py-2 text-slate-300">{s.date}</td>
                            <td className="py-2">
                              <span className="inline-flex items-center gap-1">
                                {s.type === "line" ? (
                                  <Phone className="h-3 w-3 text-sky-300" aria-hidden />
                                ) : (
                                  <Smartphone className="h-3 w-3 text-rose-300" aria-hidden />
                                )}
                                {s.type === "line" ? "خط" : "جهاز"}
                              </span>
                            </td>
                            <td className="max-w-[140px] truncate py-2">
                              {s.customer || s.deviceName || "—"}
                            </td>
                            <td className="py-2">{formatCurrency(s.amount)}</td>
                            <td className="py-2 font-bold text-emerald-300">
                              {formatCurrency(s.commission.employeeAmount)}
                            </td>
                            <td className="py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-2 text-slate-400">{s.status}</td>
                          </tr>
                          {isExp && (
                            <tr className="bg-slate-950/50">
                              <td colSpan={7} className="p-3">
                                <div className="space-y-1 text-xs">
                                  <div className="font-bold text-slate-200">حساب العمولة:</div>
                                  <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                                    {s.commission.calculation}
                                  </div>
                                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                                    <span>
                                      عمولة العقد:{" "}
                                      <span className="font-bold text-slate-200">
                                        {formatCurrency(s.commission.contractAmount)}
                                      </span>
                                    </span>
                                    <span>
                                      ربح المالك:{" "}
                                      <span className="font-bold text-slate-200">
                                        {formatCurrency(s.commission.ownerProfit)}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Sanctions */}
          {details.sanctions.length > 0 && (
            <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-rose-200">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                العقوبات ({details.sanctions.length})
              </div>
              <div className="divide-y divide-white/5">
                {details.sanctions.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400">{s.sanction_date}</div>
                      <div className="text-sm font-bold">{s.sanction_type}</div>
                      {s.description && (
                        <div className="mt-0.5 text-xs text-slate-300">{s.description}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm font-black text-rose-300">
                      −{formatCurrency(Number(s.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Milestones */}
          {details.milestones.length > 0 && (
            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-200">
                <Trophy className="h-4 w-4" aria-hidden />
                المعالم المحققة هذا الشهر
              </div>
              <ul className="space-y-2 text-sm">
                {details.milestones.map((m) => (
                  <li
                    key={`${m.threshold}-${m.hit_on}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 p-3"
                  >
                    <div>
                      معلم {formatCurrency(m.threshold)}
                      <span className="mx-2 text-slate-500">—</span>
                      <span className="text-slate-400">حصلت عليه بتاريخ {m.hit_on}</span>
                    </div>
                    <div className="font-black text-emerald-300">
                      بونص {formatCurrency(m.bonus)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Chart */}
          {chart && chartData.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold">مقارنة الأشهر</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <ToggleChip on={showSales} onClick={() => setShowSales((v) => !v)} color="#22c55e">
                    المبيعات
                  </ToggleChip>
                  <ToggleChip
                    on={showCommissions}
                    onClick={() => setShowCommissions((v) => !v)}
                    color="#38bdf8"
                  >
                    العمولات
                  </ToggleChip>
                  <ToggleChip on={showTargets} onClick={() => setShowTargets((v) => !v)} color="#f59e0b">
                    الأهداف
                  </ToggleChip>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#ffffff15" strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                        color: "#e2e8f0",
                      }}
                      formatter={(value: unknown) => {
                        const n = typeof value === "number" ? value : Number(value) || 0;
                        return formatCurrency(n);
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {showSales && (
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="المبيعات"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                    {showCommissions && (
                      <Line
                        type="monotone"
                        dataKey="commissions"
                        name="العمولات"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                    {showTargets && (
                      <Line
                        type="monotone"
                        dataKey="targets"
                        name="الأهداف"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: "sky" | "rose" | "violet" | "amber" | "slate" | "emerald";
  sub?: string;
}) {
  const cls: Record<typeof color, string> = {
    sky: "text-sky-300",
    rose: "text-rose-300",
    violet: "text-violet-300",
    amber: "text-amber-300",
    slate: "text-slate-300",
    emerald: "text-emerald-300",
  } as const;
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-black ${cls[color]}`}>{formatCurrency(value)}</div>
      {sub && <div className="mt-0.5 text-[9px] text-slate-400">{sub}</div>}
    </div>
  );
}

function ToggleChip({
  on,
  onClick,
  color,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-bold transition ${
        on ? "border-transparent text-slate-950" : "border-white/10 text-slate-300 hover:bg-white/5"
      }`}
      style={on ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}
