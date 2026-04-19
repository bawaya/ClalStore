"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { ToastContainer, Modal, FormField } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { getCsrfToken } from "@/lib/csrf-client";

type Status = "draft" | "pending" | "needs_info" | "approved" | "rejected";

type SalesRequest = {
  id: number;
  employee_id: string;
  employee_name: string | null;
  reviewer_name: string | null;
  status: Status;
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
};

type Device = { id: number; device_name: string; total_price: number; installments_count: number; monthly_installment: number };
type Package = { id: number; package_name: string; monthly_price: number; lines_count: number };
type EventRow = { id: number; event_type: string; actor_id: string | null; actor_role: string | null; message: string | null; created_at: string };

type Detail = { request: SalesRequest; devices: Device[]; packages: Package[]; events: EventRow[] };

const STATUS_META: Record<Status, { label: string; color: string }> = {
  draft:      { label: "مسوّدة",        color: "#64748b" },
  pending:    { label: "قيد المراجعة",  color: "#eab308" },
  needs_info: { label: "يحتاج توضيح",   color: "#f97316" },
  approved:   { label: "تمت الموافقة",  color: "#22c55e" },
  rejected:   { label: "مرفوض",         color: "#ef4444" },
};

const EVENT_LABEL: Record<string, string> = {
  created: "📝 أنشأ الموظف مسوّدة",
  submitted: "📤 أرسل الموظف الطلب",
  info_requested: "❓ الإدارة طلبت توضيح",
  info_provided: "↩️ الموظف أعاد الإرسال",
  approved: "✅ الإدارة اعتمدت",
  rejected: "❌ الإدارة رفضت",
  edited: "✏️ تعديل",
};

export default function AdminSalesRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showApprove, setShowApprove] = useState(false);
  const [approveNote, setApproveNote] = useState("");

  const [showInfo, setShowInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sales-requests/${id}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setData((json.data ?? json) as Detail);
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "خطأ", "error");
    } finally {
      setLoading(false);
    }
  }, [id, show]);

  useEffect(() => {
    load();
  }, [load]);

  const callAction = async (path: string, body: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sales-requests/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "فشل الإجراء");
      show(successMsg, "success");
      await load();
      setShowApprove(false);
      setShowInfo(false);
      setShowReject(false);
      setApproveNote("");
      setInfoMessage("");
      setRejectReason("");
      return (json.data ?? json) as Record<string, unknown>;
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "خطأ", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return (
      <div dir="rtl" className="text-center py-20 text-muted">
        جارٍ التحميل...
      </div>
    );
  }

  const r = data.request;
  const meta = STATUS_META[r.status];
  const total = r.total_devices_amount + r.total_packages_monthly;
  const canAct = r.status === "pending" || r.status === "needs_info";

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-black text-slate-50" style={{ fontSize: scr.mobile ? 18 : 24 }}>
            📥 طلب #{r.id}
          </h1>
          <span
            className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: `${meta.color}22`, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        <Link href="/admin/commissions/requests" className="chip text-[10px]">← القائمة</Link>
      </div>

      {/* Admin action bar */}
      {canAct && (
        <div className="card mb-4 flex flex-wrap gap-2 p-3">
          <button
            onClick={() => setShowApprove(true)}
            disabled={busy}
            className="btn-primary"
            style={{ background: "#22c55e", borderColor: "#22c55e", fontSize: 12 }}
          >
            ✅ تم بنجاح — اعتماد
          </button>
          <button
            onClick={() => setShowInfo(true)}
            disabled={busy}
            className="btn-outline"
            style={{ borderColor: "#f97316", color: "#f97316", fontSize: 12 }}
          >
            ❓ طلب تفاصيل إضافية
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={busy}
            className="btn-outline"
            style={{ borderColor: "#ef4444", color: "#ef4444", fontSize: 12 }}
          >
            ❌ رفض الطلب
          </button>
        </div>
      )}

      {/* Who/when */}
      <div className="card mb-4 p-4">
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <KV label="الموظف" value={r.employee_name || "—"} />
          <KV label="تاريخ الإنشاء" value={new Date(r.created_at).toLocaleString("he-IL")} />
          <KV label="تاريخ الإرسال" value={r.submitted_at ? new Date(r.submitted_at).toLocaleString("he-IL") : "لم يُرسل"} />
          {r.reviewed_at && (
            <KV label="تمت المراجعة" value={`${r.reviewer_name || "—"} · ${new Date(r.reviewed_at).toLocaleString("he-IL")}`} />
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="card mb-4 p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-200">👤 معلومات الزبون</h3>
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <KV label="الاسم" value={r.customer_name} />
          <KV label="رقم الهوية" value={r.customer_id_number} />
          <KV label="رقم التواصل" value={<a href={`tel:${r.contact_number}`} className="text-brand">{r.contact_number}</a>} />
          <KV label="عنوان التوصيل" value={r.delivery_address} />
        </div>
      </div>

      {/* Bank */}
      <div className="card mb-4 p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-200">💳 بيانات البنك (أمر الدفع)</h3>
        <div className="grid gap-2 md:grid-cols-3 text-sm">
          <KV label="البنك" value={`${r.bank_name}${r.bank_code ? ` (${r.bank_code})` : ""}`} />
          <KV label="الفرع" value={r.bank_branch} />
          <KV label="الحساب" value={r.bank_account} />
        </div>
      </div>

      {/* Devices */}
      <div className="card mb-4 p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-200">
          📱 الأجهزة ({data.devices.length})
        </h3>
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-surface-border text-slate-300">
              <th className="py-1.5 font-semibold">الجهاز</th>
              <th className="py-1.5 font-semibold">السعر الكلي</th>
              <th className="py-1.5 font-semibold">عدد الدفعات</th>
              <th className="py-1.5 font-semibold">الشهري</th>
            </tr>
          </thead>
          <tbody>
            {data.devices.map((d) => (
              <tr key={d.id} className="border-b border-surface-border/50">
                <td className="py-1.5 font-bold">{d.device_name}</td>
                <td className="py-1.5 text-sky-300">{formatCurrency(d.total_price)}</td>
                <td className="py-1.5">{d.installments_count}</td>
                <td className="py-1.5 text-slate-300">{formatCurrency(d.monthly_installment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Packages */}
      {data.packages.length > 0 && (
        <div className="card mb-4 p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-200">
            📡 الحڤيلات ({data.packages.length})
          </h3>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-surface-border text-slate-300">
                <th className="py-1.5 font-semibold">الحڤيلا</th>
                <th className="py-1.5 font-semibold">السعر الشهري</th>
                <th className="py-1.5 font-semibold">عدد الخطوط</th>
                <th className="py-1.5 font-semibold">الإجمالي الشهري</th>
              </tr>
            </thead>
            <tbody>
              {data.packages.map((p) => (
                <tr key={p.id} className="border-b border-surface-border/50">
                  <td className="py-1.5 font-bold">{p.package_name}</td>
                  <td className="py-1.5 text-rose-300">{formatCurrency(p.monthly_price)}</td>
                  <td className="py-1.5">{p.lines_count}</td>
                  <td className="py-1.5 text-slate-300">{formatCurrency(p.monthly_price * p.lines_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="card mb-4 p-4" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08))" }}>
        <h3 className="mb-3 text-sm font-bold text-slate-200">💰 الإجمالي</h3>
        <div className="grid gap-3 md:grid-cols-4 text-center">
          <Stat label="مبيعات أجهزة" value={formatCurrency(r.total_devices_amount)} color="#60a5fa" />
          <Stat label="خطوط شهرياً" value={formatCurrency(r.total_packages_monthly)} color="#f87171" />
          <Stat label="عدد الأجهزة" value={String(r.total_devices_count)} color="#fbbf24" />
          <Stat label="عدد الخطوط" value={String(r.total_lines_count)} color="#a78bfa" />
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-surface-border pt-3">
          <span className="text-sm font-bold text-slate-200">الإجمالي الكلي</span>
          <span className="text-2xl font-black text-emerald-400">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Previous review note (if any) */}
      {r.review_note && r.status !== "approved" && (
        <div
          className="card mb-4 p-4 text-sm"
          style={{
            background: `${meta.color}15`,
            border: `1px solid ${meta.color}50`,
          }}
        >
          <div className="font-bold mb-1" style={{ color: meta.color }}>
            ملاحظة المراجعة:
          </div>
          <div className="text-slate-100">{r.review_note}</div>
        </div>
      )}

      {/* Timeline */}
      <div className="card mb-4 p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-200">📅 سجل الطلب</h3>
        <ol className="space-y-3 border-r-2 border-surface-border pr-4">
          {data.events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -right-[21px] top-1.5 h-3 w-3 rounded-full bg-brand ring-4 ring-surface" />
              <div className="text-[12px] font-bold text-slate-100">
                {EVENT_LABEL[ev.event_type] || ev.event_type}
              </div>
              <div className="text-[10px] text-slate-400">
                {new Date(ev.created_at).toLocaleString("he-IL")}
                {ev.actor_role && <span className="mx-1">·</span>}
                {ev.actor_role}
              </div>
              {ev.message && (
                <div className="mt-1 rounded-lg bg-surface-elevated p-2 text-[11px] text-slate-200">
                  {ev.message}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Approve modal */}
      <Modal open={showApprove} onClose={() => setShowApprove(false)} title="✅ اعتماد الطلب">
        <div dir="rtl" className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[13px] text-emerald-100">
            سيتم إنشاء {data.devices.length} صف جهاز + {data.packages.reduce((s, p) => s + p.lines_count, 0)} صف خط
            وتسجيلهم على <strong>{r.employee_name || "الموظف"}</strong>. الإجمالي:{" "}
            <strong className="text-emerald-300">{formatCurrency(total)}</strong>.
            العمولة المتوقّعة تحُسب تلقائياً بناءً على نسب الموظف المحفوظة.
          </div>
          <FormField label="ملاحظة (اختياري)">
            <input
              type="text"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              className="input"
              placeholder="ملاحظة تُحفظ في سجل الطلب"
            />
          </FormField>
          <button
            onClick={() => callAction("approve", { note: approveNote || null }, "تم اعتماد الطلب وتسجيل المبيعات")}
            disabled={busy}
            className="btn-primary w-full"
            style={{ background: "#22c55e", borderColor: "#22c55e" }}
          >
            {busy ? "جارٍ الاعتماد..." : "تأكيد الاعتماد"}
          </button>
        </div>
      </Modal>

      {/* Request info modal */}
      <Modal open={showInfo} onClose={() => setShowInfo(false)} title="❓ طلب تفاصيل إضافية">
        <div dir="rtl" className="space-y-3">
          <FormField label="اكتب ما تحتاجه من الموظف" required>
            <textarea
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
              className="input"
              rows={4}
              placeholder="مثال: أرسل صورة بطاقة الهوية / أكّد رقم الحساب البنكي..."
            />
          </FormField>
          <button
            onClick={() => infoMessage.trim() && callAction("request-info", { message: infoMessage.trim() }, "تم إرسال طلب التوضيح للموظف")}
            disabled={busy || !infoMessage.trim()}
            className="btn-primary w-full"
            style={{ background: "#f97316", borderColor: "#f97316" }}
          >
            {busy ? "جارٍ الإرسال..." : "إرسال للموظف"}
          </button>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={showReject} onClose={() => setShowReject(false)} title="❌ رفض الطلب">
        <div dir="rtl" className="space-y-3">
          <FormField label="سبب الرفض" required>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input"
              rows={4}
              placeholder="اشرح للموظف لماذا لا يمكن اعتماد هذا الطلب..."
            />
          </FormField>
          <button
            onClick={() => rejectReason.trim() && callAction("reject", { reason: rejectReason.trim() }, "تم رفض الطلب")}
            disabled={busy || !rejectReason.trim()}
            className="btn-primary w-full"
            style={{ background: "#ef4444", borderColor: "#ef4444" }}
          >
            {busy ? "جارٍ الرفض..." : "تأكيد الرفض"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-surface-border/50 pb-1.5">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-100">{value}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-slate-950/40 p-3">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
