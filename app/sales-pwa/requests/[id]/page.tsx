"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileEdit,
  Trash2,
  Send,
  Calendar,
  User,
  Phone,
  MapPin,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type RequestStatus = "draft" | "pending" | "needs_info" | "approved" | "rejected";

type SalesRequest = {
  id: number;
  status: RequestStatus;
  customer_name: string;
  customer_id_number: string;
  contact_number: string;
  delivery_address: string;
  locality_name: string | null;
  bank_name: string;
  bank_code: string | null;
  bank_branch: string;
  bank_account: string;
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

type Device = {
  id: number;
  device_name: string;
  total_price: number;
  installments_count: number;
  monthly_installment: number;
};

type Package = {
  id: number;
  package_name: string;
  monthly_price: number;
  lines_count: number;
};

type EventRow = {
  id: number;
  event_type: string;
  actor_role: string | null;
  message: string | null;
  created_at: string;
};

type Detail = {
  request: SalesRequest;
  devices: Device[];
  packages: Package[];
  events: EventRow[];
};

const STATUS_META: Record<RequestStatus, { label: string; color: string; Icon: typeof Clock }> = {
  draft:      { label: "مسوّدة", color: "bg-slate-500/20 text-slate-200 border-slate-500/30", Icon: FileEdit },
  pending:    { label: "قيد المراجعة", color: "bg-amber-500/20 text-amber-200 border-amber-500/30", Icon: Clock },
  needs_info: { label: "يحتاج توضيح", color: "bg-orange-500/20 text-orange-200 border-orange-500/30", Icon: AlertCircle },
  approved:   { label: "تمت الموافقة", color: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30", Icon: CheckCircle2 },
  rejected:   { label: "مرفوض", color: "bg-rose-500/20 text-rose-200 border-rose-500/30", Icon: XCircle },
};

const EVENT_LABEL: Record<string, string> = {
  created: "📝 أنشأت مسوّدة",
  submitted: "📤 أرسل الموظف الطلب",
  info_requested: "❓ الإدارة طلبت توضيح",
  info_provided: "↩️ الموظف أجاب",
  approved: "✅ تمت الموافقة",
  rejected: "❌ رُفض الطلب",
  edited: "✏️ تم تعديل الطلب",
  deleted: "🗑️ حُذف الطلب",
};

export default function EmployeeSalesRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/employee/sales-requests/${id}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setData((json.data ?? json) as Detail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!data) return;
    if (!confirm("هل تريد حذف هذه المسوّدة؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/employee/sales-requests/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "فشل الحذف");
      }
      router.push("/sales-pwa/requests");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  const resubmitNeedsInfo = async () => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      // Resubmit the existing data (no changes — just flip status to pending).
      // If the employee needs to edit, they go through /new flow re-hydrated
      // from the draft — for simplicity here we just resubmit as-is.
      const res = await fetch(`/api/employee/sales-requests/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "فشل الإرسال");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        {error || "لم يتم العثور على الطلب"}
        <div className="mt-3">
          <Link href="/sales-pwa/requests" className="text-sky-300 hover:text-sky-200">
            ← عودة للقائمة
          </Link>
        </div>
      </div>
    );
  }

  const r = data.request;
  const meta = STATUS_META[r.status];
  const latestEvent = data.events[data.events.length - 1];

  return (
    <div className="space-y-4 pb-20">
      {/* Top bar */}
      <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <Link href="/sales-pwa/requests" className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200">
          <ArrowRight className="h-4 w-4" aria-hidden />
          عودة
        </Link>
        <div>
          <h1 className="text-lg font-black">طلب #{r.id}</h1>
          <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
            <meta.Icon className="h-3 w-3" aria-hidden />
            {meta.label}
          </div>
        </div>
      </section>

      {/* needs_info notice */}
      {r.status === "needs_info" && r.review_note && (
        <section className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-orange-200">
            <AlertCircle className="h-4 w-4" aria-hidden />
            الإدارة تطلب توضيح
          </div>
          <p className="text-sm text-orange-100">{r.review_note}</p>
          <button
            type="button"
            onClick={resubmitNeedsInfo}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-orange-950 hover:bg-orange-400 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            {busy ? "جارٍ الإرسال..." : "إعادة الإرسال"}
          </button>
        </section>
      )}

      {/* rejected notice */}
      {r.status === "rejected" && r.review_note && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-rose-200">
            <XCircle className="h-4 w-4" aria-hidden />
            تم الرفض
          </div>
          <p className="text-sm text-rose-100">{r.review_note}</p>
        </section>
      )}

      {/* Customer info */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
          <User className="h-4 w-4" aria-hidden />
          معلومات الزبون
        </h2>
        <div className="grid gap-2 text-sm">
          <KV label="الاسم" value={r.customer_name} />
          <KV label="رقم الهوية" value={r.customer_id_number} />
          <KV label="رقم التواصل" value={<a href={`tel:${r.contact_number}`} className="text-sky-300 hover:underline"><Phone className="ml-1 inline h-3 w-3" aria-hidden />{r.contact_number}</a>} />
          <KV label="عنوان التوصيل" value={<><MapPin className="ml-1 inline h-3 w-3" aria-hidden />{r.delivery_address}</>} />
        </div>
      </section>

      {/* Bank info */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
          <CreditCard className="h-4 w-4" aria-hidden />
          بيانات البنك
        </h2>
        <div className="grid gap-2 text-sm">
          <KV label="البنك" value={r.bank_name + (r.bank_code ? ` (${r.bank_code})` : "")} />
          <KV label="الفرع" value={r.bank_branch} />
          <KV label="الحساب" value={r.bank_account} />
        </div>
      </section>

      {/* Devices */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
          <Smartphone className="h-4 w-4" aria-hidden />
          الأجهزة ({data.devices.length})
        </h2>
        <div className="space-y-2">
          {data.devices.map((d) => (
            <div key={d.id} className="rounded-xl border border-white/5 bg-slate-950/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">{d.device_name}</span>
                <span className="font-black text-sky-300">{formatCurrency(d.total_price)}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {d.installments_count} دفعة × {formatCurrency(d.monthly_installment)} شهرياً
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      {data.packages.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
            <Phone className="h-4 w-4" aria-hidden />
            الحڤيلات ({data.packages.length})
          </h2>
          <div className="space-y-2">
            {data.packages.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/5 bg-slate-950/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{p.package_name}</span>
                  <span className="font-black text-rose-300">
                    {formatCurrency(p.monthly_price)}/شهر × {p.lines_count} خط
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Totals */}
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
        <h2 className="mb-3 text-sm font-bold">الإجمالي</h2>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell label="مبيعات أجهزة" value={formatCurrency(r.total_devices_amount)} color="sky" />
          <SummaryCell label="خطوط شهري" value={formatCurrency(r.total_packages_monthly)} color="rose" />
          <SummaryCell label="عدد الأجهزة" value={String(r.total_devices_count)} color="amber" />
          <SummaryCell label="عدد الخطوط" value={String(r.total_lines_count)} color="violet" />
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
          <Calendar className="h-4 w-4" aria-hidden />
          سجل الطلب
        </h2>
        <ol className="space-y-3 border-r-2 border-white/10 pr-4">
          {data.events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -right-[21px] top-1.5 h-3 w-3 rounded-full bg-sky-400 ring-4 ring-slate-900" />
              <div className="text-[12px] font-bold">{EVENT_LABEL[ev.event_type] || ev.event_type}</div>
              <div className="text-[10px] text-slate-400">
                {new Date(ev.created_at).toLocaleString("he-IL")}
                {ev.actor_role && <span className="mx-1">·</span>}
                {ev.actor_role}
              </div>
              {ev.message && <div className="mt-1 rounded-lg bg-slate-950/50 p-2 text-[11px] text-slate-200">{ev.message}</div>}
            </li>
          ))}
        </ol>
      </section>

      {/* Draft actions */}
      {r.status === "draft" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            حذف المسوّدة
          </button>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-100">{value}</span>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "sky" | "rose" | "amber" | "violet";
}) {
  const cls: Record<typeof color, string> = {
    sky: "text-sky-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  } as const;
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`mt-1 text-base font-black ${cls[color]}`}>{value}</div>
    </div>
  );
}
