"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

type Doc = any;

export default function SalesDocDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [data, setData] = useState<{ doc: Doc; items: any[]; attachments: any[]; events: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [attType, setAttType] = useState("invoice");
  const [attPath, setAttPath] = useState("");
  const [attName, setAttName] = useState("");
  const [attMime, setAttMime] = useState("application/pdf");
  const [attSize, setAttSize] = useState<number>(1000);
  const [mutating, setMutating] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pwa/sales/${id}`, { headers: csrfHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || "فشل في تحميل العملية");
      setData(json.data || json);
    } catch (e: any) {
      setError(e?.message || "خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addAttachment() {
    if (!id) return;
    setMutating(true);
    setError("");
    try {
      const res = await fetch(`/api/pwa/sales/${id}/attachments`, {
        method: "POST",
        headers: { ...csrfHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          attachment_type: attType,
          file_path: attPath || `/placeholder/${attType}/${Date.now()}.pdf`,
          file_name: attName || `${attType}.pdf`,
          mime_type: attMime,
          file_size: Number(attSize || 0) || 1000,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || "فشل في إضافة المرفق");
      await load();
      setAttPath("");
      setAttName("");
    } catch (e: any) {
      setError(e?.message || "خطأ");
    } finally {
      setMutating(false);
    }
  }

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
      if (!res.ok || json?.success === false) throw new Error(json?.error || "فشل في الإرسال");
      await load();
    } catch (e: any) {
      setError(e?.message || "خطأ");
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
                {doc.sale_type} • {doc.status} • {doc.sale_date || "بدون تاريخ"} • ₪{Number(doc.total_amount || 0).toLocaleString("he-IL")}
              </div>
            ) : null}
            {doc?.customer && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                <span className="text-sm font-bold text-emerald-200">{doc.customer.name}</span>
                <span className="text-xs text-emerald-300/70" dir="ltr">{doc.customer.phone}</span>
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
      {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      {!loading && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-black">المرفقات</div>
            <div className="mt-1 text-sm text-slate-400">أضف المرفقات المطلوبة ثم أرسل العملية.</div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <div className="text-sm text-slate-300">نوع المرفق</div>
                <select
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={attType}
                  onChange={(e) => setAttType(e.target.value)}
                >
                  <option value="contract_photo">contract_photo</option>
                  <option value="signed_form">signed_form</option>
                  <option value="invoice">invoice</option>
                  <option value="device_serial_proof">device_serial_proof</option>
                  <option value="payment_proof">payment_proof</option>
                </select>
              </label>
              <label className="space-y-1">
                <div className="text-sm text-slate-300">Mime</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={attMime}
                  onChange={(e) => setAttMime(e.target.value)}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <div className="text-sm text-slate-300">اسم الملف</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={attName}
                  onChange={(e) => setAttName(e.target.value)}
                  placeholder="invoice.pdf"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <div className="text-sm text-slate-300">مسار التخزين (مؤقت)</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={attPath}
                  onChange={(e) => setAttPath(e.target.value)}
                  placeholder="/storage/sales-docs/..."
                />
              </label>
              <label className="space-y-1">
                <div className="text-sm text-slate-300">الحجم</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  type="number"
                  min={1}
                  value={attSize}
                  onChange={(e) => setAttSize(Number(e.target.value))}
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={addAttachment}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                  disabled={mutating || !doc || !["draft", "rejected"].includes(doc.status)}
                >
                  إضافة مرفق
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {(data.attachments || []).length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 text-sm text-slate-400">لا يوجد مرفقات بعد.</div>
              ) : (
                (data.attachments || []).map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="text-sm font-bold">{a.attachment_type}</div>
                    <div className="text-xs text-slate-400">{a.file_name} • {a.mime_type} • {a.file_size}</div>
                    <div className="mt-1 text-xs text-slate-500">{a.file_path}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-black">السجل</div>
            <div className="mt-1 text-sm text-slate-400">كل تغيير يسجل كحدث (Audit trail).</div>

            <div className="mt-4 space-y-2">
              {(data.events || []).length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 text-sm text-slate-400">لا يوجد أحداث بعد.</div>
              ) : (
                (data.events || []).slice().reverse().map((e: any) => (
                  <div key={e.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold">{e.event_type}</div>
                      <div className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString("he-IL")}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{e.actor_role || ""}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

