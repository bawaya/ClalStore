"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { Modal, FormField, ToastContainer, StatCard, EmptyState } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { getCsrfToken } from "@/lib/csrf-client";

export interface SalesDoc {
  id: number;
  doc_uuid: string;
  employee_user_id: string | null;
  employee_key: string;
  customer_id: string | null;
  order_id: string | null;
  sale_type: "line" | "device" | "mixed";
  status: string;
  sale_date: string | null;
  total_amount: number;
  currency: string;
  source: string;
  notes: string | null;
  created_at: string;
  submitted_at: string | null;
  verified_at: string | null;
  synced_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

export interface EmployeeOption {
  id: string;
  name: string;
  role?: string;
}

interface DetailData {
  doc: SalesDoc;
  items: Array<{
    id: number;
    item_type: string;
    product_name: string | null;
    qty: number;
    unit_price: number;
    line_total: number;
  }>;
  events: Array<{
    id: number;
    event_type: string;
    actor_user_id: string | null;
    actor_role: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
  }>;
  commissions: Array<{ id: number; sale_type: string; commission_amount: number; deleted_at: string | null }>;
  commission_ids: number[];
  customer: { id: string; name: string; phone: string; email: string | null; city: string | null } | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "#71717a" },
  submitted: { label: "مُرسلة", color: "#3b82f6" },
  verified: { label: "موثقة", color: "#0ea5e9" },
  synced_to_commissions: { label: "مُسجَّلة بالعمولات", color: "#22c55e" },
  cancelled: { label: "ملغاة", color: "#ef4444" },
  rejected: { label: "مرفوضة", color: "#f97316" },
};

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  pipeline: { label: "بايبلاين", icon: "🧭" },
  pwa: { label: "PWA", icon: "📱" },
  manual: { label: "يدوي", icon: "✏️" },
  auto_sync: { label: "مزامنة", icon: "🔄" },
};

const SALE_TYPE_LABEL: Record<string, string> = {
  line: "خط",
  device: "جهاز",
  mixed: "مختلط",
};

export default function SalesDocsClient({
  initialDocs,
  initialTotal,
  employees,
  initialFilters,
}: {
  initialDocs: SalesDoc[];
  initialTotal: number;
  employees: EmployeeOption[];
  initialFilters: {
    status: string;
    employee_key: string;
    source: string;
    from: string;
    to: string;
    search: string;
  };
}) {
  const scr = useScreen();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { toasts, show, dismiss } = useToast();

  const [docs, setDocs] = useState<SalesDoc[]>(initialDocs);
  const [total, setTotal] = useState<number>(initialTotal);
  const [loading, setLoading] = useState(false);

  const [fStatus, setFStatus] = useState(initialFilters.status);
  const [fEmployee, setFEmployee] = useState(initialFilters.employee_key);
  const [fSource, setFSource] = useState(initialFilters.source);
  const [fFrom, setFFrom] = useState(initialFilters.from);
  const [fTo, setFTo] = useState(initialFilters.to);
  const [fSearch, setFSearch] = useState(initialFilters.search);

  // Cancel modal
  const [cancelDoc, setCancelDoc] = useState<SalesDoc | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Detail drawer
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sync URL and re-fetch when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (fStatus) params.set("status", fStatus);
    if (fEmployee) params.set("employee_key", fEmployee);
    if (fSource) params.set("source", fSource);
    if (fFrom) params.set("from", fFrom);
    if (fTo) params.set("to", fTo);
    const t = fSearch.trim();
    if (t) params.set("search", t);
    const next = params.toString();
    if (next !== searchParamsKey) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [fStatus, fEmployee, fSource, fFrom, fTo, fSearch, pathname, router, searchParamsKey]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fStatus) params.set("status", fStatus);
      if (fEmployee) params.set("employee_key", fEmployee);
      if (fSource) params.set("source", fSource);
      if (fFrom) params.set("from", fFrom);
      if (fTo) params.set("to", fTo);
      const t = fSearch.trim();
      if (t) params.set("search", t);
      const res = await fetch(`/api/admin/sales-docs?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const list = (json.data?.docs || json.docs || []) as SalesDoc[];
      setDocs(list);
      setTotal(json.meta?.total ?? list.length);
    } catch {
      show("فشل تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  }, [fStatus, fEmployee, fSource, fFrom, fTo, fSearch, show]);

  // Re-fetch when filters change (skip first render — initial data is SSR)
  const [initialRender, setInitialRender] = useState(true);
  useEffect(() => {
    if (initialRender) {
      setInitialRender(false);
      return;
    }
    fetchDocs();
  }, [fetchDocs, initialRender]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: docs.length, synced: 0, cancelled: 0, pending: 0 };
    for (const d of docs) {
      if (d.status === "synced_to_commissions") s.synced++;
      else if (d.status === "cancelled") s.cancelled++;
      else if (d.status === "submitted" || d.status === "verified" || d.status === "draft") s.pending++;
    }
    return s;
  }, [docs]);

  const employeeName = (key: string | null | undefined) => {
    if (!key) return "—";
    const e = employees.find((x) => x.id === key);
    return e?.name || key;
  };

  const openDetail = async (id: number) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/sales-docs/${id}/detail`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDetail((json.data || json) as DetailData);
    } catch {
      show("فشل تحميل تفاصيل الوثيقة", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelDoc) return;
    if (cancelReason.trim().length < 3) {
      show("الرجاء كتابة سبب (٣ أحرف على الأقل)", "warning");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/sales-docs/${cancelDoc.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "فشل الإلغاء");
      }
      show("تم الإلغاء بنجاح", "success");
      setCancelDoc(null);
      setCancelReason("");
      await fetchDocs();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل الإلغاء";
      show(msg, "error");
    } finally {
      setCancelling(false);
    }
  };

  const cancellable = (s: string) =>
    s === "synced_to_commissions" || s === "verified" || s === "submitted";

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("ar-EG") : "—";

  return (
    <div dir="rtl" className="font-arabic">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>
          📄 إدارة وثائق المبيعات
        </h1>
        <div className="text-muted text-[10px]">الإجمالي: {total}</div>
      </div>

      {/* Stats */}
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}
      >
        <StatCard icon="📦" label="الكل" value={stats.total} color="#fafafa" />
        <StatCard icon="✅" label="مُسجَّلة" value={stats.synced} color="#22c55e" />
        <StatCard icon="⏳" label="قيد المراجعة" value={stats.pending} color="#3b82f6" />
        <StatCard icon="🚫" label="ملغاة" value={stats.cancelled} color="#ef4444" />
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">من تاريخ</label>
            <input type="date" className="input" style={{ fontSize: 11 }} value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">إلى تاريخ</label>
            <input type="date" className="input" style={{ fontSize: 11 }} value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">الحالة</label>
            <select className="input" style={{ fontSize: 11 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">الكل</option>
              <option value="draft">مسودة</option>
              <option value="submitted">مُرسلة</option>
              <option value="synced_to_commissions">مُسجَّلة</option>
              <option value="cancelled">ملغاة</option>
              <option value="rejected">مرفوضة</option>
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">المصدر</label>
            <select className="input" style={{ fontSize: 11 }} value={fSource} onChange={(e) => setFSource(e.target.value)}>
              <option value="">الكل</option>
              <option value="pipeline">بايبلاين</option>
              <option value="pwa">PWA</option>
              <option value="manual">يدوي</option>
              <option value="auto_sync">مزامنة</option>
            </select>
          </div>
          <div style={{ minWidth: 150 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">الموظف</label>
            <select className="input" style={{ fontSize: 11 }} value={fEmployee} onChange={(e) => setFEmployee(e.target.value)}>
              <option value="">الكل</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="text-muted text-[10px] font-semibold block mb-1">بحث</label>
            <input
              className="input"
              style={{ fontSize: 11 }}
              placeholder="رقم طلب / رقم عميل / ملاحظات"
              value={fSearch}
              onChange={(e) => setFSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
        {loading ? (
          <div className="text-center text-muted text-xs py-8">⏳ جارٍ التحميل...</div>
        ) : docs.length === 0 ? (
          <EmptyState icon="📭" title="لا توجد وثائق" sub="جرّب تغيير الفلاتر" />
        ) : scr.mobile ? (
          // Mobile cards
          <div className="flex flex-col gap-2">
            {docs.map((d) => {
              const sm = STATUS_META[d.status] || { label: d.status, color: "#71717a" };
              const src = SOURCE_META[d.source] || { label: d.source, icon: "•" };
              return (
                <div key={d.id} className="rounded-xl border border-surface-border p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="badge text-[9px]" style={{ background: `${sm.color}20`, color: sm.color }}>
                      {sm.label}
                    </span>
                    <span className="font-bold text-[11px]">#{d.id}</span>
                  </div>
                  <div className="text-[10px] text-muted">
                    {fmtDate(d.sale_date || d.created_at)} · {employeeName(d.employee_key)}
                  </div>
                  <div className="text-[10px]">
                    {SALE_TYPE_LABEL[d.sale_type] || d.sale_type} · {formatCurrency(Number(d.total_amount) || 0)}
                  </div>
                  <div className="text-[9px] text-muted">
                    {src.icon} {src.label}
                    {d.order_id ? ` · #${d.order_id}` : ""}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => openDetail(d.id)}
                      className="btn-outline flex-1"
                      style={{ fontSize: 10, padding: "4px 8px" }}
                    >
                      عرض
                    </button>
                    {cancellable(d.status) && (
                      <button
                        onClick={() => {
                          setCancelDoc(d);
                          setCancelReason("");
                        }}
                        className="flex-1 rounded-xl bg-state-error text-white font-bold border-0 cursor-pointer"
                        style={{ fontSize: 10, padding: "4px 8px" }}
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop table
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ fontSize: 11 }}>
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-1.5 font-semibold">إجراءات</th>
                  <th className="py-1.5 font-semibold">المصدر</th>
                  <th className="py-1.5 font-semibold">الحالة</th>
                  <th className="py-1.5 font-semibold">الإجمالي</th>
                  <th className="py-1.5 font-semibold">النوع</th>
                  <th className="py-1.5 font-semibold">العميل / الطلب</th>
                  <th className="py-1.5 font-semibold">الموظف</th>
                  <th className="py-1.5 font-semibold">التاريخ</th>
                  <th className="py-1.5 font-semibold">#</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const sm = STATUS_META[d.status] || { label: d.status, color: "#71717a" };
                  const src = SOURCE_META[d.source] || { label: d.source, icon: "•" };
                  const hasComm = d.status === "synced_to_commissions";
                  return (
                    <tr key={d.id} className="border-b border-surface-border/50">
                      <td className="py-1.5">
                        <div className="flex gap-1 justify-start">
                          <button
                            onClick={() => openDetail(d.id)}
                            className="chip"
                            style={{ fontSize: 9, padding: "3px 8px" }}
                          >
                            عرض
                          </button>
                          {cancellable(d.status) && (
                            <button
                              onClick={() => {
                                setCancelDoc(d);
                                setCancelReason("");
                              }}
                              className="rounded-md border-0 cursor-pointer font-bold text-white"
                              style={{ fontSize: 9, padding: "3px 8px", background: "#ef4444" }}
                            >
                              إلغاء
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 text-[10px]">
                        <span title={src.label}>
                          {src.icon} {src.label}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <span
                          className="badge text-[9px]"
                          style={{ background: `${sm.color}20`, color: sm.color }}
                        >
                          {sm.label}
                        </span>
                      </td>
                      <td className="py-1.5 font-bold">
                        {formatCurrency(Number(d.total_amount) || 0)}
                      </td>
                      <td className="py-1.5">
                        {SALE_TYPE_LABEL[d.sale_type] || d.sale_type}
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-col">
                          <span>{d.customer_id ? `🧑 ${d.customer_id.slice(0, 8)}…` : "—"}</span>
                          {d.order_id && (
                            <span className="text-muted text-[9px]">#{d.order_id}</span>
                          )}
                          {hasComm && (
                            <Link
                              href={`/admin/commissions/history?search=${encodeURIComponent(String(d.order_id || d.id))}`}
                              className="text-brand text-[9px]"
                            >
                              عرض العمولة ←
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5">{employeeName(d.employee_key)}</td>
                      <td className="py-1.5">{fmtDate(d.sale_date || d.created_at)}</td>
                      <td className="py-1.5 font-mono text-[10px]">{d.id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <Modal
        open={!!cancelDoc}
        onClose={() => !cancelling && setCancelDoc(null)}
        title="🚫 إلغاء الوثيقة"
      >
        <div dir="rtl">
          {cancelDoc && (
            <>
              <div className="text-[12px] mb-3 text-muted">
                سيتم تغيير حالة الوثيقة <b>#{cancelDoc.id}</b> إلى <b>ملغاة</b>
                <br />
                وسيتم حذف أي عمولات مرتبطة بها (soft-delete) وإعادة احتساب الشهر.
              </div>
              <div className="bg-state-error/10 border border-state-error/30 rounded-xl px-3 py-2 mb-3 text-[11px] text-state-error text-right">
                ⚠️ لا يمكن التراجع إذا كان الشهر مقفلاً. ستحتاج لفتحه أولاً.
              </div>
              <FormField label="سبب الإلغاء (٣ أحرف على الأقل)" required>
                <textarea
                  className="input"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="اكتب السبب..."
                />
              </FormField>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setCancelDoc(null)}
                  disabled={cancelling}
                  className="btn-outline flex-1"
                >
                  تراجع
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling || cancelReason.trim().length < 3}
                  className="flex-1 rounded-xl bg-state-error text-white font-bold border-0 cursor-pointer py-2"
                  style={{ opacity: cancelling ? 0.5 : 1 }}
                >
                  {cancelling ? "⏳ جارٍ الإلغاء..." : "تأكيد الإلغاء"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Detail Drawer (modal style) */}
      <Modal
        open={detailId !== null}
        onClose={() => {
          setDetailId(null);
          setDetail(null);
        }}
        title={detailId ? `🧾 وثيقة #${detailId}` : "تفاصيل"}
        wide
      >
        <div dir="rtl">
          {detailLoading ? (
            <div className="text-center text-muted text-xs py-6">⏳ جارٍ التحميل...</div>
          ) : !detail ? (
            <div className="text-center text-dim text-xs py-6">لا توجد بيانات</div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Meta */}
              <div className="grid gap-2 text-[11px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <span className="text-muted">الحالة: </span>
                  <b style={{ color: STATUS_META[detail.doc.status]?.color }}>
                    {STATUS_META[detail.doc.status]?.label || detail.doc.status}
                  </b>
                </div>
                <div>
                  <span className="text-muted">الإجمالي: </span>
                  <b>{formatCurrency(Number(detail.doc.total_amount) || 0)}</b>
                </div>
                <div>
                  <span className="text-muted">النوع: </span>
                  <b>{SALE_TYPE_LABEL[detail.doc.sale_type] || detail.doc.sale_type}</b>
                </div>
                <div>
                  <span className="text-muted">المصدر: </span>
                  <b>{SOURCE_META[detail.doc.source]?.label || detail.doc.source}</b>
                </div>
                <div>
                  <span className="text-muted">تاريخ البيع: </span>
                  <b>{fmtDate(detail.doc.sale_date)}</b>
                </div>
                <div>
                  <span className="text-muted">الموظف: </span>
                  <b>{employeeName(detail.doc.employee_key)}</b>
                </div>
                {detail.doc.order_id && (
                  <div>
                    <span className="text-muted">رقم الطلب: </span>
                    <b>#{detail.doc.order_id}</b>
                  </div>
                )}
                {detail.customer && (
                  <div>
                    <span className="text-muted">العميل: </span>
                    <b>{detail.customer.name}</b> — {detail.customer.phone}
                  </div>
                )}
                {detail.doc.cancellation_reason && (
                  <div className="col-span-2 text-state-error text-[10px]">
                    سبب الإلغاء: {detail.doc.cancellation_reason}
                  </div>
                )}
                {detail.doc.rejection_reason && (
                  <div className="col-span-2 text-[10px]" style={{ color: "#f97316" }}>
                    سبب الرفض: {detail.doc.rejection_reason}
                  </div>
                )}
              </div>

              {/* Linked commissions */}
              {detail.commissions.length > 0 && (
                <div>
                  <h4 className="font-bold text-[12px] mb-1">💰 العمولات المرتبطة</h4>
                  <div className="rounded-xl border border-surface-border p-2 text-[11px] flex flex-col gap-1">
                    {detail.commissions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className={c.deleted_at ? "text-dim line-through" : ""}>
                          #{c.id} · {c.sale_type} · {formatCurrency(Number(c.commission_amount) || 0)}
                        </span>
                        <Link
                          href={`/admin/commissions/history?search=${c.id}`}
                          className="text-brand text-[10px]"
                        >
                          فتح ←
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <h4 className="font-bold text-[12px] mb-1">🛒 العناصر ({detail.items.length})</h4>
                {detail.items.length === 0 ? (
                  <div className="text-dim text-[10px]">لا توجد عناصر</div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted border-b border-surface-border">
                        <th className="py-1 font-semibold text-right">المنتج</th>
                        <th className="py-1 font-semibold text-right">النوع</th>
                        <th className="py-1 font-semibold text-right">الكمية</th>
                        <th className="py-1 font-semibold text-right">السعر</th>
                        <th className="py-1 font-semibold text-right">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.id} className="border-b border-surface-border/40">
                          <td className="py-1">{it.product_name || "—"}</td>
                          <td className="py-1">{it.item_type}</td>
                          <td className="py-1">{it.qty}</td>
                          <td className="py-1">{formatCurrency(Number(it.unit_price) || 0)}</td>
                          <td className="py-1 font-bold">{formatCurrency(Number(it.line_total) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Events timeline */}
              <div>
                <h4 className="font-bold text-[12px] mb-1">📜 سجل الأحداث ({detail.events.length})</h4>
                {detail.events.length === 0 ? (
                  <div className="text-dim text-[10px]">لا أحداث</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {detail.events.map((e) => (
                      <div key={e.id} className="rounded-lg bg-surface-elevated px-2 py-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{e.event_type}</span>
                          <span className="text-muted text-[9px]">
                            {new Date(e.created_at).toLocaleString("ar-EG")}
                          </span>
                        </div>
                        <div className="text-muted text-[9px]">
                          {e.actor_role || "—"}{e.actor_user_id ? ` · ${e.actor_user_id.slice(0, 8)}…` : ""}
                        </div>
                        {e.payload && Object.keys(e.payload).length > 0 && (
                          <pre className="text-[9px] text-dim mt-1 whitespace-pre-wrap break-all font-mono">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
