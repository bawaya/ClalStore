"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, FileEdit, MessageSquare } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { REQUEST_TYPE_LABELS } from "@/app/sales-pwa/_shared/labels";

type CorrectionStatus = "pending" | "approved" | "rejected" | "resolved";

type CorrectionRequest = {
  id: number;
  employee_id: string;
  commission_sale_id: number | null;
  sales_doc_id: number | null;
  request_type: keyof typeof REQUEST_TYPE_LABELS | string;
  description: string;
  status: CorrectionStatus;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
};

type SaleOption = {
  id: number;
  date: string;
  type: "line" | "device";
  amount: number;
  customer: string | null;
  deviceName: string | null;
};

function statusPill(s: CorrectionStatus | string): { label: string; cls: string } {
  switch (s) {
    case "pending":
      return { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-200" };
    case "approved":
      return { label: "مقبول", cls: "bg-emerald-500/15 text-emerald-200" };
    case "rejected":
      return { label: "مرفوض", cls: "bg-rose-500/15 text-rose-200" };
    case "resolved":
      return { label: "مُنجز", cls: "bg-slate-500/15 text-slate-200" };
    default:
      return { label: String(s), cls: "bg-white/10 text-slate-200" };
  }
}

function currentMonthIL(): string {
  const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
}

export default function CorrectionsPage() {
  const [list, setList] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/employee/corrections", { credentials: "same-origin" });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string } | undefined)?.error || "فشل التحميل");
      const requests = (json as { requests?: CorrectionRequest[] }).requests;
      setList(Array.isArray(requests) ? requests : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <FileEdit className="h-5 w-5 text-violet-300" aria-hidden />
          <div>
            <div className="text-sm font-bold">طلبات التصحيح · בקשות תיקון</div>
            <div className="text-[11px] text-slate-400">طلباتي المقدمة للإدارة</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" aria-hidden />
          طلب جديد
        </button>
      </section>

      {loading && <div className="text-sm text-slate-400">جاري التحميل…</div>}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && list.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          لا توجد طلبات تصحيح بعد.
        </div>
      )}

      <ul className="space-y-2">
        {list.map((r) => {
          const p = statusPill(r.status);
          return (
            <li key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">{timeAgo(r.created_at)}</div>
                  <div className="mt-0.5 text-sm font-bold">
                    {REQUEST_TYPE_LABELS[r.request_type] || r.request_type}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${p.cls}`}>
                  {p.label}
                </span>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{r.description}</div>
              {r.admin_response && (r.status === "resolved" || r.status === "approved" || r.status === "rejected") && (
                <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-sky-200">
                    <MessageSquare className="h-3 w-3" aria-hidden />
                    رد الإدارة
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-100">
                    {r.admin_response}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {modalOpen && <NewCorrectionModal onClose={() => setModalOpen(false)} onDone={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}

function NewCorrectionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [month, setMonth] = useState<string>(currentMonthIL());
  const [sales, setSales] = useState<SaleOption[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [saleId, setSaleId] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [requestType, setRequestType] =
    useState<keyof typeof REQUEST_TYPE_LABELS>("amount_error");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSales(true);
      try {
        const res = await fetch(`/api/employee/commissions/details?month=${encodeURIComponent(month)}`, {
          credentials: "same-origin",
        });
        const json: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSales([]);
          return;
        }
        const list = (json as { sales?: SaleOption[] }).sales;
        if (Array.isArray(list)) setSales(list);
      } finally {
        if (!cancelled) setLoadingSales(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return sales.slice(0, 30);
    return sales
      .filter(
        (s) =>
          (s.customer || "").toLowerCase().includes(q) ||
          (s.deviceName || "").toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          s.date.includes(q),
      )
      .slice(0, 30);
  }, [sales, searchQ]);

  async function submit() {
    if (description.trim().length < 10) {
      setErr("الوصف لازم 10 أحرف على الأقل");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      const res = await fetch("/api/employee/corrections", {
        method: "POST",
        headers: { ...csrfHeaders(), "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          commissionSaleId: saleId,
          requestType,
          description: description.trim(),
        }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string } | undefined)?.error || "فشل الإرسال");
      }
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center p-2 md:items-center">
      <button type="button" onClick={onClose} aria-label="إغلاق" className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-black">طلب تصحيح جديد</div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 hover:bg-white/10">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {/* Month + search */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">الشهر</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                aria-label="الشهر"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-400">بحث</span>
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="اسم، رقم، تاريخ…"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                aria-label="بحث في المبيعات"
              />
            </label>
          </div>

          {/* Sale picker */}
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400">اختر بيعة (اختياري)</div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-slate-900">
              {loadingSales ? (
                <div className="p-3 text-xs text-slate-400">جاري التحميل…</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-xs text-slate-400">لا توجد نتائج — يمكنك المتابعة بدون ربط</div>
              ) : (
                <ul className="divide-y divide-white/5">
                  <li>
                    <button
                      type="button"
                      onClick={() => setSaleId(null)}
                      className={`w-full px-3 py-2 text-right text-xs ${
                        saleId === null ? "bg-emerald-500/15 text-emerald-200" : "hover:bg-white/5"
                      }`}
                    >
                      بدون ربط (طلب عام)
                    </button>
                  </li>
                  {filtered.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSaleId(s.id)}
                        className={`w-full px-3 py-2 text-right text-xs ${
                          saleId === s.id ? "bg-emerald-500/15 text-emerald-200" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>#{s.id} · {s.type === "line" ? "خط" : "جهاز"}</span>
                          <span className="text-slate-400">{s.date}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.customer || s.deviceName || "—"} · {formatCurrency(s.amount)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Request type */}
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-400">نوع الطلب</span>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as keyof typeof REQUEST_TYPE_LABELS)}
              aria-label="نوع طلب التصحيح"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          {/* Description */}
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-400">الوصف (10–2000 حرف)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرح المشكلة بتفصيل كافٍ…"
              className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
              maxLength={2000}
            />
            <div className="text-left text-[10px] text-slate-500">{description.length}/2000</div>
          </label>

          {err && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            {submitting ? "جاري الإرسال…" : "إرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}
