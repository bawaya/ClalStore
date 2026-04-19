"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileEdit as DraftIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type RequestStatus = "draft" | "pending" | "needs_info" | "approved" | "rejected";

type RequestRow = {
  id: number;
  status: RequestStatus;
  customer_name: string;
  customer_id_number: string;
  total_devices_amount: number;
  total_packages_monthly: number;
  total_devices_count: number;
  total_lines_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_META: Record<RequestStatus, { label: string; color: string; Icon: typeof Clock }> = {
  draft:      { label: "مسوّدة", color: "bg-slate-500/20 text-slate-200 border-slate-500/30", Icon: DraftIcon },
  pending:    { label: "قيد المراجعة", color: "bg-amber-500/20 text-amber-200 border-amber-500/30", Icon: Clock },
  needs_info: { label: "يحتاج توضيح", color: "bg-orange-500/20 text-orange-200 border-orange-500/30", Icon: AlertCircle },
  approved:   { label: "تمت الموافقة", color: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30", Icon: CheckCircle2 },
  rejected:   { label: "مرفوض", color: "bg-rose-500/20 text-rose-200 border-rose-500/30", Icon: XCircle },
};

type FilterKey = "all" | RequestStatus;

export default function EmployeeSalesRequestsListPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/employee/sales-requests", { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      const data = (json.data ?? json) as { requests?: RequestRow[] };
      setRows(data.requests || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: rows.length, draft: 0, pending: 0, needs_info: 0, approved: 0, rejected: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-black">
            <ClipboardList className="h-5 w-5 text-sky-300" aria-hidden />
            طلبات المبيعات
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            أرسل طلبك، والإدارة تعتمده قبل ما يتحوّل لبيعة ويُسجَّل على حسابك
          </p>
        </div>
        <Link
          href="/sales-pwa/requests/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
        >
          <Plus className="h-5 w-5" aria-hidden />
          طلب جديد
        </Link>
      </section>

      {/* Status filter chips */}
      <section className="flex flex-wrap gap-2 text-xs">
        {(["all", "pending", "needs_info", "approved", "rejected", "draft"] as FilterKey[]).map((k) => {
          const active = filter === k;
          const label = k === "all" ? "الكل" : STATUS_META[k as RequestStatus].label;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1.5 font-bold transition ${
                active
                  ? "border-sky-400 bg-sky-500/25 text-sky-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {label} <span className="mr-1 opacity-70">({counts[k]})</span>
            </button>
          );
        })}
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-500" aria-hidden />
          <div className="mt-3 text-sm font-bold text-slate-200">لا توجد طلبات</div>
          <p className="mt-1 text-xs text-slate-400">
            ابدأ بإرسال طلب جديد عن طريق زر &ldquo;طلب جديد&rdquo; في الأعلى.
          </p>
        </section>
      )}

      {/* Rows */}
      <section className="space-y-2">
        {filtered.map((r) => {
          const meta = STATUS_META[r.status];
          const total = r.total_devices_amount + r.total_packages_monthly;
          return (
            <Link
              key={r.id}
              href={`/sales-pwa/requests/${r.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
            >
              <div className="min-w-0 flex-1 text-right">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
                    <meta.Icon className="h-3 w-3" aria-hidden />
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-slate-400">#{r.id}</span>
                </div>
                <div className="mt-1 text-sm font-bold">{r.customer_name}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  هوية: {r.customer_id_number}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-300">
                  <span>🔧 {r.total_devices_count} جهاز ({formatCurrency(r.total_devices_amount)})</span>
                  {r.total_lines_count > 0 && (
                    <span>📡 {r.total_lines_count} خط ({formatCurrency(r.total_packages_monthly)}/شهر)</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-left">
                <div className="text-sm font-black text-slate-100">{formatCurrency(total)}</div>
                <div className="text-[9px] text-slate-500">
                  {new Date(r.updated_at).toLocaleDateString("he-IL")}
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
