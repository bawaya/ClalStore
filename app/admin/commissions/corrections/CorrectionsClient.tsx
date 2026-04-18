"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Modal,
  FormField,
  PageHeader,
  EmptyState,
  ToastContainer,
} from "@/components/admin/shared";
import { useScreen, useToast } from "@/lib/hooks";
import { csrfHeaders } from "@/lib/csrf-client";

export type TabKey = "pending" | "approved" | "rejected" | "resolved" | "all";

export type CorrectionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resolved";

export type CorrectionRequestType =
  | "amount_error"
  | "wrong_type"
  | "wrong_date"
  | "wrong_customer"
  | "missing_sale"
  | "other";

export interface CorrectionRow {
  id: number;
  employee_id: string;
  employeeName: string;
  commission_sale_id: number | null;
  sales_doc_id: number | null;
  request_type: CorrectionRequestType;
  description: string;
  status: CorrectionStatus;
  admin_response: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

const STATUS_META: Record<CorrectionStatus, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "#f97316" },
  approved: { label: "موافَق", color: "#22c55e" },
  rejected: { label: "مرفوض", color: "#ef4444" },
  resolved: { label: "مكتمل", color: "#8b5cf6" },
};

const TYPE_META: Record<CorrectionRequestType, { label: string; color: string }> = {
  amount_error: { label: "خطأ في المبلغ", color: "#3b82f6" },
  wrong_type: { label: "نوع غير صحيح", color: "#0ea5e9" },
  wrong_date: { label: "تاريخ خاطئ", color: "#f59e0b" },
  wrong_customer: { label: "عميل خاطئ", color: "#ef4444" },
  missing_sale: { label: "مبيعة ناقصة", color: "#8b5cf6" },
  other: { label: "أخرى", color: "#71717a" },
};

const TAB_META: Array<{ key: TabKey; label: string }> = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "موافَق" },
  { key: "rejected", label: "مرفوضة" },
  { key: "resolved", label: "مكتملة" },
  { key: "all", label: "الكل" },
];

function truncate(value: string, n = 80): string {
  if (value.length <= n) return value;
  return value.slice(0, n - 1).trimEnd() + "…";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ar-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

type Decision = "approved" | "rejected" | "resolved";

const DECISION_META: Record<Decision, { label: string; color: string; icon: string }> = {
  approved: { label: "موافقة", color: "#22c55e", icon: "✅" },
  rejected: { label: "رفض", color: "#ef4444", icon: "❌" },
  resolved: { label: "مكتمل", color: "#8b5cf6", icon: "🏁" },
};

export default function CorrectionsClient({
  initialRows,
  initialTab,
  counts,
}: {
  initialRows: CorrectionRow[];
  initialTab: TabKey;
  counts: Record<TabKey, number>;
}) {
  const router = useRouter();
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [active, setActive] = useState<CorrectionRow | null>(null);
  const [decision, setDecision] = useState<Decision>("approved");
  const [adminResponse, setAdminResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openDecision = useCallback(
    (row: CorrectionRow, d: Decision) => {
      setActive(row);
      setDecision(d);
      setAdminResponse("");
    },
    [],
  );

  const closeDecision = useCallback(() => {
    setActive(null);
    setAdminResponse("");
  }, []);

  const onSubmit = useCallback(async () => {
    if (!active) return;
    if (adminResponse.trim().length < 2) {
      show("الرد المطلوب قصير جداً", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/corrections/${active.id}`, {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({
          status: decision,
          adminResponse: adminResponse.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "فشل حفظ الرد");
      }
      show(`تم تسجيل الرد: ${DECISION_META[decision].label}`, "success");
      closeDecision();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      show(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }, [active, decision, adminResponse, show, router, closeDecision]);

  const onTabChange = useCallback(
    (next: TabKey) => {
      setTab(next);
      const href =
        next === "pending"
          ? "/admin/commissions/corrections"
          : `/admin/commissions/corrections?tab=${next}`;
      router.push(href);
    },
    [router],
  );

  return (
    <div dir="rtl" className="font-arabic">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <PageHeader title="📝 طلبات تصحيح العمولات" count={counts[tab]} />

      {/* Tab filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TAB_META.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={tab === t.key ? "chip chip-active" : "chip"}
            style={{ fontSize: 11 }}
          >
            {t.label}{" "}
            <span className="text-muted ml-1">({counts[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {initialRows.length === 0 ? (
        <EmptyState
          icon="📭"
          title="لا توجد طلبات في هذا القسم"
          sub={tab === "pending" ? "كل الطلبات تم الرد عليها 🎉" : undefined}
        />
      ) : (
        <div className="card" style={{ padding: scr.mobile ? 8 : 12 }}>
          <div className="overflow-x-auto">
            <table
              className="w-full text-right"
              style={{ fontSize: scr.mobile ? 10 : 12 }}
            >
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-2 font-semibold">الموظف</th>
                  <th className="py-2 font-semibold">المبيعة</th>
                  <th className="py-2 font-semibold">النوع</th>
                  <th className="py-2 font-semibold">الوصف</th>
                  <th className="py-2 font-semibold">الحالة</th>
                  <th className="py-2 font-semibold">تاريخ</th>
                  <th className="py-2 font-semibold">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {initialRows.map((r) => {
                  const statusMeta = STATUS_META[r.status];
                  const typeMeta = TYPE_META[r.request_type];
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-surface-border/50"
                    >
                      <td className="py-2 font-bold">{r.employeeName}</td>
                      <td className="py-2">
                        {r.commission_sale_id ? (
                          <Link
                            href={`/admin/commissions/history?sale_id=${r.commission_sale_id}`}
                            className="text-brand font-bold"
                          >
                            #{r.commission_sale_id}
                          </Link>
                        ) : r.sales_doc_id ? (
                          <Link
                            href={`/admin/sales-docs?search=${r.sales_doc_id}`}
                            className="text-brand font-bold"
                          >
                            وثيقة #{r.sales_doc_id}
                          </Link>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className="badge text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: typeMeta.color,
                            background: `${typeMeta.color}15`,
                          }}
                        >
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="py-2">
                        <div>{truncate(r.description, 80)}</div>
                        {r.admin_response && (
                          <div className="text-[10px] text-muted mt-1">
                            الرد: {truncate(r.admin_response, 60)}
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className="badge text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: statusMeta.color,
                            background: `${statusMeta.color}15`,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="py-2 text-muted">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="py-2">
                        {r.status === "pending" ? (
                          <div className="flex flex-wrap gap-1 justify-end">
                            <button
                              onClick={() => openDecision(r, "approved")}
                              className="px-2 py-1 rounded-lg text-[9px] font-bold border-0 cursor-pointer"
                              style={{
                                color: "#fff",
                                background: DECISION_META.approved.color,
                              }}
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => openDecision(r, "rejected")}
                              className="px-2 py-1 rounded-lg text-[9px] font-bold border-0 cursor-pointer"
                              style={{
                                color: "#fff",
                                background: DECISION_META.rejected.color,
                              }}
                            >
                              رفض
                            </button>
                            <button
                              onClick={() => openDecision(r, "resolved")}
                              className="px-2 py-1 rounded-lg text-[9px] font-bold border-0 cursor-pointer"
                              style={{
                                color: "#fff",
                                background: DECISION_META.resolved.color,
                              }}
                            >
                              مكتمل
                            </button>
                          </div>
                        ) : (
                          <span className="text-dim text-[10px]">
                            {r.resolved_at ? formatDate(r.resolved_at) : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!active}
        onClose={closeDecision}
        title={
          active
            ? `${DECISION_META[decision].icon} ${DECISION_META[decision].label} — طلب #${active.id}`
            : ""
        }
        wide
      >
        <div dir="rtl">
          {active && (
            <>
              <div className="card mb-3" style={{ padding: 12 }}>
                <div className="text-muted text-[10px]">الموظف</div>
                <div className="font-bold mb-2">{active.employeeName}</div>
                <div className="text-muted text-[10px]">نوع الطلب</div>
                <div className="font-bold mb-2">
                  {TYPE_META[active.request_type].label}
                </div>
                <div className="text-muted text-[10px]">وصف الطلب</div>
                <div className="text-sm whitespace-pre-wrap">
                  {active.description}
                </div>
              </div>
              <FormField label="ردّ الإدارة" required>
                <textarea
                  className="input"
                  rows={5}
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  maxLength={2000}
                  placeholder="اشرح سبب القرار…"
                />
              </FormField>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={closeDecision}
                  className="btn-outline flex-1"
                  disabled={submitting}
                >
                  إلغاء
                </button>
                <button
                  onClick={onSubmit}
                  className="flex-1 px-5 py-2.5 rounded-xl text-white font-bold cursor-pointer border-0"
                  style={{ background: DECISION_META[decision].color }}
                  disabled={submitting}
                >
                  {submitting
                    ? "جاري الحفظ…"
                    : `${DECISION_META[decision].icon} ${DECISION_META[decision].label}`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
