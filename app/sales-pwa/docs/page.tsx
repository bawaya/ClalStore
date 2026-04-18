"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";

type Doc = {
  id: number;
  sale_type: string;
  status: string;
  sale_date: string | null;
  total_amount: number;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  customer?: { id: string; name: string; phone: string; customer_code?: string } | null;
};

function pill(status: string): string {
  if (status === "draft") return "bg-slate-500/15 text-slate-200";
  if (status === "submitted") return "bg-sky-500/15 text-sky-200";
  if (status === "verified") return "bg-emerald-500/15 text-emerald-200";
  if (status === "rejected") return "bg-rose-500/15 text-rose-200";
  if (status === "synced_to_commissions") return "bg-violet-500/15 text-violet-200";
  return "bg-white/10 text-slate-100";
}

export default function SalesPwaDocsListPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<string>("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    return params.toString();
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/pwa/sales${query ? `?${query}` : ""}`, { headers: csrfHeaders() });
        const json: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || (typeof json === "object" && json !== null && (json as { success?: boolean }).success === false)) {
          const msg = (json as { error?: string } | undefined)?.error || "فشل في تحميل العمليات";
          throw new Error(msg);
        }
        const data = (json as { data?: { docs?: Doc[] }; docs?: Doc[] });
        setDocs(data.data?.docs || data.docs || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطأ في التحميل");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">الوثائق / מסמכים</div>
            <div className="text-xl font-black">عمليات التوثيق</div>
          </div>
          <Link
            href="/sales-pwa/new"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-400"
          >
            عملية جديدة
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-400">فلتر:</div>
          <select
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            aria-label="فلتر حالة عمليات التوثيق"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">الكل</option>
            <option value="draft">مسودة</option>
            <option value="submitted">مُرسلة</option>
            <option value="verified">معتمدة</option>
            <option value="rejected">مرفوضة</option>
            <option value="synced_to_commissions">تم ترحيلها للعمولات</option>
          </select>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-400">جاري التحميل…</div>}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          لا توجد عمليات بعد. ابدأ بإنشاء عملية جديدة.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {docs.map((d) => (
          <Link
            key={d.id}
            href={`/sales-pwa/docs/${d.id}`}
            className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm text-slate-400">#{d.id}</div>
                <div className="text-base font-bold">
                  {d.sale_type === "line" ? "خط" : d.sale_type === "device" ? "جهاز" : "مختلط"}
                  {d.order_id ? <span className="text-slate-400"> • {d.order_id}</span> : null}
                </div>
                {d.customer && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                    <span>{d.customer.name}</span>
                    {d.customer.customer_code && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px]">
                        {d.customer.customer_code}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  {d.sale_date ? d.sale_date : "بدون تاريخ"} • ₪
                  {Number(d.total_amount || 0).toLocaleString("he-IL")}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${pill(d.status)}`}>
                {d.status}
              </span>
            </div>
            {d.notes ? (
              <div className="mt-3 line-clamp-2 text-sm text-slate-300">{d.notes}</div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">لا توجد ملاحظات</div>
            )}
            <div className="mt-3 text-xs text-slate-500">
              آخر تحديث: {new Date(d.created_at).toLocaleString("he-IL")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
