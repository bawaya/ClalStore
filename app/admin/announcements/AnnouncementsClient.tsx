"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  FormField,
  PageHeader,
  EmptyState,
  ToastContainer,
} from "@/components/admin/shared";
import { useScreen, useToast } from "@/lib/hooks";
import { csrfHeaders } from "@/lib/csrf-client";

export interface AdminAnnouncementRow {
  id: number;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  target: "all" | "employees" | "admins";
  created_by: string;
  expires_at: string | null;
  created_at: string;
  readCount: number;
  totalRecipients: number;
}

const PRIORITY_META: Record<
  AdminAnnouncementRow["priority"],
  { label: string; color: string }
> = {
  low: { label: "منخفضة", color: "#71717a" },
  normal: { label: "عادية", color: "#3b82f6" },
  high: { label: "مرتفعة", color: "#f97316" },
  urgent: { label: "عاجل", color: "#ef4444" },
};

const TARGET_META: Record<
  AdminAnnouncementRow["target"],
  { label: string; color: string }
> = {
  all: { label: "الجميع", color: "#8b5cf6" },
  employees: { label: "الموظفون", color: "#22c55e" },
  admins: { label: "الإدارة", color: "#0ea5e9" },
};

function truncate(value: string, n = 60): string {
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

export default function AnnouncementsClient({
  initialAnnouncements,
  totalRecipients,
}: {
  initialAnnouncements: AdminAnnouncementRow[];
  totalRecipients: number;
}) {
  const scr = useScreen();
  const router = useRouter();
  const { toasts, show, dismiss } = useToast();
  const [rows] = useState<AdminAnnouncementRow[]>(initialAnnouncements);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] =
    useState<AdminAnnouncementRow["priority"]>("normal");
  const [target, setTarget] =
    useState<AdminAnnouncementRow["target"]>("employees");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const resetForm = useCallback(() => {
    setTitle("");
    setBody("");
    setPriority("normal");
    setTarget("employees");
    setExpiresAt("");
  }, []);

  const onSubmit = useCallback(async () => {
    if (title.trim().length < 2) {
      show("العنوان قصير جداً", "warning");
      return;
    }
    if (body.trim().length < 2) {
      show("النص قصير جداً", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim(),
        priority,
        target,
      };
      if (expiresAt) {
        const iso = new Date(expiresAt).toISOString();
        payload.expiresAt = iso;
      }
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "فشل نشر الرسالة");
      }
      show("تم نشر الرسالة بنجاح", "success");
      setShowCreate(false);
      resetForm();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      show(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }, [title, body, priority, target, expiresAt, show, router, resetForm]);

  const hasRows = rows.length > 0;
  const stats = useMemo(() => {
    const unreadFor = (r: AdminAnnouncementRow) =>
      Math.max(0, r.totalRecipients - r.readCount);
    let pendingReads = 0;
    for (const r of rows) pendingReads += unreadFor(r);
    return {
      count: rows.length,
      recipients: totalRecipients,
      pendingReads,
    };
  }, [rows, totalRecipients]);

  return (
    <div dir="rtl" className="font-arabic">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <PageHeader
        title="📣 رسائل للموظفين"
        count={stats.count}
        onAdd={() => {
          resetForm();
          setShowCreate(true);
        }}
        addLabel="رسالة جديدة"
      />

      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
        <div className="card" style={{ padding: scr.mobile ? 12 : 16 }}>
          <div className="text-muted" style={{ fontSize: 10 }}>إجمالي الرسائل</div>
          <div className="font-black" style={{ fontSize: 22 }}>{stats.count}</div>
        </div>
        <div className="card" style={{ padding: scr.mobile ? 12 : 16 }}>
          <div className="text-muted" style={{ fontSize: 10 }}>مستلمون محتملون</div>
          <div className="font-black" style={{ fontSize: 22 }}>{stats.recipients}</div>
        </div>
        <div className="card" style={{ padding: scr.mobile ? 12 : 16 }}>
          <div className="text-muted" style={{ fontSize: 10 }}>قراءات معلّقة</div>
          <div className="font-black" style={{ fontSize: 22, color: stats.pendingReads > 0 ? "#f97316" : "#22c55e" }}>
            {stats.pendingReads}
          </div>
        </div>
      </div>

      {!hasRows ? (
        <EmptyState
          icon="📭"
          title="لا توجد رسائل بعد"
          sub="ابدأ بنشر أول رسالة للموظفين"
        />
      ) : (
        <div className="card" style={{ padding: scr.mobile ? 8 : 12 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-2 font-semibold">العنوان</th>
                  <th className="py-2 font-semibold">الأولوية</th>
                  <th className="py-2 font-semibold">الجمهور</th>
                  <th className="py-2 font-semibold">قرأ / الكل</th>
                  <th className="py-2 font-semibold">ينتهي</th>
                  <th className="py-2 font-semibold">أنشئت</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const priorityMeta = PRIORITY_META[r.priority];
                  const targetMeta = TARGET_META[r.target];
                  const percent =
                    r.totalRecipients > 0
                      ? Math.round((r.readCount / r.totalRecipients) * 100)
                      : 0;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-surface-border/50"
                    >
                      <td className="py-2">
                        <div className="font-bold">{truncate(r.title, 48)}</div>
                        <div className="text-muted text-[10px] mt-0.5">
                          {truncate(r.body, 80)}
                        </div>
                      </td>
                      <td className="py-2">
                        <span
                          className="badge text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: priorityMeta.color,
                            background: `${priorityMeta.color}15`,
                          }}
                        >
                          {priorityMeta.label}
                        </span>
                      </td>
                      <td className="py-2">
                        <span
                          className="badge text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: targetMeta.color,
                            background: `${targetMeta.color}15`,
                          }}
                        >
                          {targetMeta.label}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="font-bold">
                          {r.readCount}/{r.totalRecipients}
                        </div>
                        <div className="w-16 h-1 bg-surface-elevated rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percent}%`,
                              background:
                                percent >= 80
                                  ? "#22c55e"
                                  : percent >= 40
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2">{formatDate(r.expires_at)}</td>
                      <td className="py-2 text-muted">
                        {formatDate(r.created_at)}
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
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        title="📣 رسالة جديدة"
        wide
      >
        <div dir="rtl">
          <FormField label="العنوان" required>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="مثال: تحديث على سياسة العمولات"
            />
          </FormField>
          <FormField label="النص" required>
            <textarea
              className="input"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              placeholder="اكتب نص الرسالة…"
            />
          </FormField>
          <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
            <FormField label="الأولوية">
              <select
                className="input"
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value as AdminAnnouncementRow["priority"],
                  )
                }
                aria-label="أولوية الرسالة"
              >
                <option value="low">منخفضة</option>
                <option value="normal">عادية</option>
                <option value="high">مرتفعة</option>
                <option value="urgent">عاجل</option>
              </select>
            </FormField>
            <FormField label="الجمهور المستهدف">
              <select
                className="input"
                value={target}
                onChange={(e) =>
                  setTarget(e.target.value as AdminAnnouncementRow["target"])
                }
                aria-label="جمهور الرسالة"
              >
                <option value="all">الجميع</option>
                <option value="employees">الموظفون فقط</option>
                <option value="admins">الإدارة فقط</option>
              </select>
            </FormField>
          </div>
          <FormField label="تاريخ الانتهاء (اختياري)">
            <input
              type="datetime-local"
              className="input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
              className="btn-outline flex-1"
              disabled={submitting}
            >
              إلغاء
            </button>
            <button
              onClick={onSubmit}
              className="btn-primary flex-1"
              disabled={submitting}
            >
              {submitting ? "جاري النشر…" : "📣 نشر"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
