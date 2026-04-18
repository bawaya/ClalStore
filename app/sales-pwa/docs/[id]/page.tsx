"use client";

/**
 * Sales doc detail — data-only view.
 *
 * No attachments: the agent sees the doc fields and the audit-trail events,
 * and can submit (which registers the commission directly).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

type Doc = {
  id: number;
  sale_type: string;
  status: string;
  sale_date: string | null;
  total_amount: number;
  customer?: {
    name: string;
    phone: string;
    customer_code?: string;
  } | null;
};

type EventRow = {
  id: number;
  event_type: string;
  actor_role?: string | null;
  created_at: string;
};

type DetailResponse = {
  doc: Doc;
  items: unknown[];
  events: EventRow[];
};

export default function SalesDocDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pwa/sales/${id}`, { headers: csrfHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "فشل في تحميل العملية");
      }
      setData(json.data || json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submit() {
    if (!id) return;
    setMutating(true);
    setError("");
    try {
      const res = await fetch(`/api/pwa/sales/${id}/submit`, {
        method: "POST",
        headers: csrfHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "فشل في الإرسال");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setMutating(false);
    }
  }

  const doc = data?.doc;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">تفاصيل العملية</div>
            <div className="text-2xl font-black">#{id}</div>
            {doc ? (
              <div className="mt-1 text-sm text-slate-400">
                {doc.sale_type} • {doc.status} • {doc.sale_date || "بدون تاريخ"} • ₪
                {Number(doc.total_amount || 0).toLocaleString("he-IL")}
              </div>
            ) : null}
            {doc?.customer && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                <span className="text-sm font-bold text-emerald-200">{doc.customer.name}</span>
                <span className="text-xs text-emerald-300/70" dir="ltr">
                  {doc.customer.phone}
                </span>
                {doc.customer.customer_code && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-mono text-emerald-300">
                    {doc.customer.customer_code}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/sales-pwa")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
              disabled={loading || mutating}
            >
              رجوع
            </button>
            <button
              onClick={submit}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-sky-950 hover:bg-sky-400 disabled:opacity-60"
              disabled={loading || mutating || !doc || !["draft", "rejected"].includes(doc.status)}
            >
              إرسال
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-400">جاري التحميل…</div>}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && data && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-lg font-black">السجل</div>
          <div className="mt-1 text-sm text-slate-400">كل تغيير يسجل كحدث (Audit trail).</div>

          <div className="mt-4 space-y-2">
            {(data.events || []).length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 text-sm text-slate-400">
                لا يوجد أحداث بعد.
              </div>
            ) : (
              (data.events || [])
                .slice()
                .reverse()
                .map((e) => (
                  <div key={e.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold">{e.event_type}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(e.created_at).toLocaleString("he-IL")}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{e.actor_role || ""}</div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
