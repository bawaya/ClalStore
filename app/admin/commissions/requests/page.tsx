"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

type Status = "draft" | "pending" | "needs_info" | "approved" | "rejected";

type RequestRow = {
  id: number;
  employee_id: string;
  employee_name: string | null;
  status: Status;
  customer_name: string;
  customer_id_number: string;
  contact_number: string;
  bank_name: string;
  total_devices_amount: number;
  total_packages_monthly: number;
  total_devices_count: number;
  total_lines_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

const STATUS_META: Record<Status, { label: string; color: string }> = {
  draft:      { label: "مسوّدة",        color: "#64748b" },
  pending:    { label: "قيد المراجعة",  color: "#eab308" },
  needs_info: { label: "يحتاج توضيح",   color: "#f97316" },
  approved:   { label: "تمت الموافقة",  color: "#22c55e" },
  rejected:   { label: "مرفوض",         color: "#ef4444" },
};

type Filter = "active" | "pending" | "needs_info" | "approved" | "rejected" | "all";

export default function AdminSalesRequestsListPage() {
  const scr = useScreen();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (filter !== "all") qs.set("status", filter);
      const res = await fetch(`/api/admin/sales-requests?${qs.toString()}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setRows(((json.data ?? json) as { requests?: RequestRow[] }).requests || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const filters: Array<{ key: Filter; label: string }> = useMemo(
    () => [
      { key: "active", label: "تحتاج إجراء" },
      { key: "pending", label: "قيد المراجعة" },
      { key: "needs_info", label: "يحتاج توضيح" },
      { key: "approved", label: "تمت الموافقة" },
      { key: "rejected", label: "مرفوض" },
      { key: "all", label: "الكل" },
    ],
    [],
  );

  return (
    <div dir="rtl" className="font-hebrew">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black text-slate-50" style={{ fontSize: scr.mobile ? 18 : 24 }}>
          📥 طلبات المبيعات
        </h1>
        <Link href="/admin/commissions" className="chip chip-active text-[10px]">
          ← العمولات
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`chip text-[11px] ${filter === f.key ? "chip-active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="card mb-4 border border-state-error/30 bg-state-error/10 p-3 text-right text-sm text-state-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="card p-6 text-center text-muted text-sm">
          جارٍ التحميل...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="card p-8 text-center text-slate-300">
          <div className="text-sm font-bold">لا يوجد طلبات في هذه الحالة</div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card overflow-x-auto" style={{ padding: scr.mobile ? 8 : 12 }}>
          <table className="w-full text-right" style={{ fontSize: scr.mobile ? 11 : 13 }}>
            <thead>
              <tr className="text-slate-200 border-b border-surface-border">
                <th className="py-2 font-bold">#</th>
                <th className="py-2 font-bold">الحالة</th>
                <th className="py-2 font-bold">الموظف</th>
                <th className="py-2 font-bold">الزبون</th>
                <th className="py-2 font-bold">الأجهزة</th>
                <th className="py-2 font-bold">الخطوط</th>
                <th className="py-2 font-bold">إجمالي مبيعات</th>
                <th className="py-2 font-bold">تاريخ الإرسال</th>
                <th className="py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = STATUS_META[r.status];
                const total = r.total_devices_amount + r.total_packages_monthly;
                return (
                  <tr key={r.id} className="border-b border-surface-border/50 hover:bg-surface-elevated/30">
                    <td className="py-2 text-slate-300">#{r.id}</td>
                    <td className="py-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-slate-100">
                      {r.employee_name || <span className="text-state-warning">—</span>}
                    </td>
                    <td className="py-2">
                      <div className="font-semibold text-slate-100">{r.customer_name}</div>
                      <div className="text-[10px] text-slate-400">{r.customer_id_number}</div>
                    </td>
                    <td className="py-2 text-slate-100">
                      {r.total_devices_count}
                      <span className="text-[10px] text-slate-400"> · {formatCurrency(r.total_devices_amount)}</span>
                    </td>
                    <td className="py-2 text-slate-100">
                      {r.total_lines_count > 0 ? (
                        <>
                          {r.total_lines_count}
                          <span className="text-[10px] text-slate-400"> · {formatCurrency(r.total_packages_monthly)}/شهر</span>
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2 font-black text-state-success">{formatCurrency(total)}</td>
                    <td className="py-2 text-slate-300 text-[10px]">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString("he-IL") : "—"}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/admin/commissions/requests/${r.id}`}
                        className="btn-outline text-[10px]"
                        style={{ padding: "4px 10px" }}
                      >
                        فتح
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
