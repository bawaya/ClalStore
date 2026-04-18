"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Sale = {
  id: number;
  sale_date: string;
  sale_type: "line" | "device";
  customer_name: string | null;
  device_name: string | null;
  package_price: number | null;
  device_sale_amount: number | null;
  commission_amount: number;
  source: string;
};

type Sanction = {
  id: number;
  sanction_date: string;
  sanction_type: string;
  amount: number;
  description: string | null;
  has_sale_offset: boolean | null;
};

type SalesDoc = {
  id: number;
  doc_uuid: string;
  sale_type: string;
  status: "draft" | "submitted" | "verified" | "rejected" | "synced_to_commissions" | "cancelled";
  sale_date: string | null;
  total_amount: number;
  notes: string | null;
  rejection_reason: string | null;
  order_id: string | null;
  created_at: string;
};

type Summary = {
  linesCommission: number;
  devicesCommission: number;
  loyaltyBonus: number;
  grossCommission: number;
  totalSanctions: number;
  netCommission: number;
  targetAmount: number;
  targetProgress: number;
};

type Payload = {
  month: string;
  summary: Summary;
  sales: Sale[];
  sanctions: Sanction[];
  sales_docs: SalesDoc[];
  target: { target_total: number; target_lines_count: number; target_devices_count: number } | null;
};

type Tab = "sales" | "sanctions" | "docs";

function currentMonthIL(): string {
  const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
}

function lastSixMonths(): string[] {
  const out: string[] = [];
  const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  for (let i = 0; i < 6; i++) {
    const d = new Date(nowIL.getFullYear(), nowIL.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function sourceBadge(source: string): { label: string; color: string } {
  switch (source) {
    case "pipeline":
      return { label: "Pipeline", color: "#8b5cf6" };
    case "sales_doc":
    case "pwa":
      return { label: "PWA", color: "#3b82f6" };
    case "order":
    case "auto_sync":
      return { label: "Order", color: "#22c55e" };
    case "manual":
      return { label: "ידני / يدوي", color: "#f59e0b" };
    case "csv_import":
      return { label: "CSV", color: "#64748b" };
    default:
      return { label: source, color: "#94a3b8" };
  }
}

function docStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case "draft":
      return { label: "مسودة / טיוטה", color: "#64748b" };
    case "submitted":
      return { label: "مُرسَل / נשלח", color: "#3b82f6" };
    case "verified":
      return { label: "مُتحقَّق / אומת", color: "#22c55e" };
    case "rejected":
      return { label: "مرفوض / נדחה", color: "#ef4444" };
    case "cancelled":
      return { label: "مُلغى / מבוטל", color: "#f97316" };
    case "synced_to_commissions":
      return { label: "تمت المزامنة / סונכרן", color: "#8b5cf6" };
    default:
      return { label: status, color: "#94a3b8" };
  }
}

export default function CommissionsClient({
  employee,
}: {
  employee: { id: string; name: string; email?: string };
}) {
  const [month, setMonth] = useState<string>(currentMonthIL());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("sales");
  const [err, setErr] = useState<string | null>(null);

  const months = useMemo(() => lastSixMonths(), []);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/employee/commissions?month=${encodeURIComponent(m)}`);
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "فشل تحميل البيانات");
      }
      setData((json.data || json) as Payload);
    } catch (e: any) {
      setErr(e?.message || "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [month, fetchData]);

  return (
    <div dir="rtl" className="font-arabic space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-black text-lg md:text-xl">
            العمولات الشخصية / עמלות אישיות
          </h1>
          <div className="text-muted text-xs mt-0.5">
            {employee.name}
            {employee.email ? <span className="mr-1"> · {employee.email}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted">الشهر / חודש</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
            style={{ width: 130, fontSize: 12, padding: "6px 10px" }}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && (
        <div className="card p-3 border border-state-error/30 bg-state-error/10 text-state-error text-sm">
          {err}
        </div>
      )}

      {loading && !data ? (
        <div className="text-center py-12 text-muted">جاري التحميل... / טוען...</div>
      ) : data ? (
        <>
          <SummaryCards summary={data.summary} />
          <TargetProgress summary={data.summary} target={data.target} />
          <TabsBar tab={tab} setTab={setTab} counts={{
            sales: data.sales.length,
            sanctions: data.sanctions.length,
            docs: data.sales_docs.length,
          }} />
          {tab === "sales" && <SalesTable sales={data.sales} />}
          {tab === "sanctions" && <SanctionsList sanctions={data.sanctions} />}
          {tab === "docs" && <DocsList docs={data.sales_docs} />}
        </>
      ) : null}
    </div>
  );
}

function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    { label: "קווים / خطوط", value: summary.linesCommission, color: "#3b82f6" },
    { label: "מכשירים / أجهزة", value: summary.devicesCommission, color: "#ef4444" },
    { label: "נאמנות / ولاء", value: summary.loyaltyBonus, color: "#a855f7" },
    { label: "ברוטו / إجمالي", value: summary.grossCommission, color: "#0ea5e9" },
    { label: "סנקציות / عقوبات", value: summary.totalSanctions, color: "#f97316" },
    { label: "נטו / صافي", value: summary.netCommission, color: "#22c55e" },
  ];
  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="card p-3 text-center"
          style={{ borderRight: `3px solid ${c.color}` }}
        >
          <div className="text-muted text-[10px] mb-1">{c.label}</div>
          <div className="font-black text-sm md:text-base" style={{ color: c.color }}>
            {formatCurrency(c.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TargetProgress({
  summary,
  target,
}: {
  summary: Summary;
  target: Payload["target"];
}) {
  if (!target || target.target_total <= 0) {
    return (
      <div className="card p-3 text-center text-xs text-dim">
        لم يتم تحديد هدف لهذا الشهر / לא הוגדר יעד לחודש זה
      </div>
    );
  }
  const pct = Math.min(100, summary.targetProgress);
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2 text-[11px] text-muted">
        <span>
          {formatCurrency(summary.netCommission)} / {formatCurrency(target.target_total)} · {pct}%
        </span>
        <span className="font-bold text-white">התקדמות ליעד / تقدم نحو الهدف</span>
      </div>
      <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {(target.target_lines_count > 0 || target.target_devices_count > 0) && (
        <div className="flex gap-4 mt-2 text-[10px] text-muted justify-end">
          {target.target_lines_count > 0 && <span>يעد קווים: {target.target_lines_count}</span>}
          {target.target_devices_count > 0 && <span>يעد מכשירים: {target.target_devices_count}</span>}
        </div>
      )}
    </div>
  );
}

function TabsBar({
  tab,
  setTab,
  counts,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  counts: { sales: number; sanctions: number; docs: number };
}) {
  const items: { key: Tab; label: string; count: number }[] = [
    { key: "sales", label: "מכירות / المبيعات", count: counts.sales },
    { key: "sanctions", label: "סנקציות / العقوبات", count: counts.sanctions },
    { key: "docs", label: "מסמכים / الوثائق", count: counts.docs },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setTab(it.key)}
          className={tab === it.key ? "chip chip-active" : "chip"}
        >
          {it.label} <span className="opacity-70">({it.count})</span>
        </button>
      ))}
    </div>
  );
}

function SalesTable({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return <div className="card p-6 text-center text-dim text-sm">لا توجد مبيعات / אין מכירות</div>;
  }
  return (
    <div className="card p-3 overflow-x-auto">
      <table className="w-full text-right text-[11px] md:text-[12px]">
        <thead>
          <tr className="text-muted border-b border-surface-border">
            <th className="py-1.5 font-semibold">מקור / مصدر</th>
            <th className="py-1.5 font-semibold">עמלה / عمولة</th>
            <th className="py-1.5 font-semibold">סכום / مبلغ</th>
            <th className="py-1.5 font-semibold">פרטים / تفاصيل</th>
            <th className="py-1.5 font-semibold">סוג / نوع</th>
            <th className="py-1.5 font-semibold">תאריך / تاريخ</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => {
            const badge = sourceBadge(s.source);
            const amount = s.sale_type === "line" ? s.package_price || 0 : s.device_sale_amount || 0;
            const label = s.sale_type === "line" ? s.customer_name || "—" : s.device_name || "—";
            return (
              <tr key={s.id} className="border-b border-surface-border/50">
                <td className="py-1.5">
                  <span
                    className="badge text-[9px]"
                    style={{ background: `${badge.color}20`, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="py-1.5 font-bold" style={{ color: "#22c55e" }}>
                  {formatCurrency(s.commission_amount)}
                </td>
                <td className="py-1.5">{formatCurrency(amount)}</td>
                <td className="py-1.5 truncate max-w-[180px]">{label}</td>
                <td className="py-1.5">
                  <span
                    className="badge text-[9px]"
                    style={{
                      background: s.sale_type === "line" ? "#3b82f620" : "#ef444420",
                      color: s.sale_type === "line" ? "#3b82f6" : "#ef4444",
                    }}
                  >
                    {s.sale_type === "line" ? "קו / خط" : "מכשיר / جهاز"}
                  </span>
                </td>
                <td className="py-1.5 text-muted">{s.sale_date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SanctionsList({ sanctions }: { sanctions: Sanction[] }) {
  if (sanctions.length === 0) {
    return <div className="card p-6 text-center text-dim text-sm">لا توجد عقوبات / אין סנקציות</div>;
  }
  return (
    <div className="space-y-2">
      {sanctions.map((s) => (
        <div
          key={s.id}
          className="card p-3"
          style={{ borderRight: "3px solid #f97316" }}
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-state-error text-sm">
              -{formatCurrency(s.amount)}
            </div>
            <div className="text-right">
              <div className="font-bold text-sm">{s.sanction_type}</div>
              <div className="text-[10px] text-muted">{s.sanction_date}</div>
            </div>
          </div>
          {s.description && (
            <div className="mt-2 text-[11px] text-muted text-right border-t border-surface-border pt-2">
              {s.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DocsList({ docs }: { docs: SalesDoc[] }) {
  if (docs.length === 0) {
    return <div className="card p-6 text-center text-dim text-sm">لا توجد وثائق / אין מסמכים</div>;
  }
  return (
    <div className="space-y-2">
      {docs.map((d) => {
        const badge = docStatusBadge(d.status);
        return (
          <div
            key={d.id}
            className="card p-3"
            style={{ borderRight: `3px solid ${badge.color}` }}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="badge text-[10px] whitespace-nowrap"
                style={{ background: `${badge.color}20`, color: badge.color }}
              >
                {badge.label}
              </span>
              <div className="text-right flex-1">
                <div className="font-bold text-sm">
                  {d.sale_type === "line" ? "קו / خط" : d.sale_type === "device" ? "מכשיר / جهاز" : "مختلط / מעורב"}{" "}
                  · {formatCurrency(d.total_amount)}
                </div>
                <div className="text-[10px] text-muted">
                  {d.sale_date || d.created_at.slice(0, 10)}
                  {d.order_id ? ` · #${d.order_id}` : ""}
                </div>
              </div>
            </div>
            {d.notes && (
              <div className="mt-2 text-[11px] text-muted text-right border-t border-surface-border pt-2">
                {d.notes}
              </div>
            )}
            {d.status === "rejected" && d.rejection_reason && (
              <div className="mt-2 text-[11px] text-state-error text-right border-t border-state-error/20 pt-2">
                سبب الرفض / סיבת דחייה: {d.rejection_reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
