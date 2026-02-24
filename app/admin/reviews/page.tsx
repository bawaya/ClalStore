"use client";

export const dynamic = 'force-dynamic';

// =====================================================
// ClalMobile — Admin Reviews Moderation
// Approve, reject, reply to product reviews
// =====================================================

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader, Modal, FormField, EmptyState, ConfirmDialog } from "@/components/admin/shared";

interface Review {
  id: string;
  product_id: string;
  customer_name: string;
  customer_phone?: string;
  rating: number;
  title?: string;
  body?: string;
  verified_purchase: boolean;
  status: string;
  admin_reply?: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pending:  { label: "بانتظار الموافقة", color: "#f97316", icon: "⏳" },
  approved: { label: "منشور", color: "#22c55e", icon: "✅" },
  rejected: { label: "مرفوض", color: "#ef4444", icon: "❌" },
};

export default function AdminReviewsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [deleteReview, setDeleteReview] = useState<Review | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews?admin=true");
      const json = await res.json();
      setReviews(json.reviews || []);
    } catch {}
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      show(status === "approved" ? "✅ تم الموافقة" : "❌ تم الرفض");
      load();
    } catch {
      show("❌ خطأ", "error");
    }
  };

  const submitReply = async () => {
    if (!replyReview || !replyText.trim()) return;
    try {
      const res = await fetch("/api/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: replyReview.id, admin_reply: replyText }),
      });
      if (!res.ok) throw new Error();
      show("✅ تم إضافة الرد");
      setReplyReview(null);
      setReplyText("");
      load();
    } catch {
      show("❌ خطأ", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteReview) return;
    try {
      await fetch(`/api/reviews?id=${deleteReview.id}`, { method: "DELETE" });
      show("🗑️ تم الحذف");
      setDeleteReview(null);
      load();
    } catch {
      show("❌ خطأ", "error");
    }
  };

  const filtered = filter === "all" ? reviews : reviews.filter((r) => r.status === filter);
  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader
        title={`⭐ إدارة التقييمات${pendingCount > 0 ? ` (${pendingCount} بانتظار)` : ""}`}
        count={reviews.length}
      />

      {/* Filters */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {[
          { key: "all", label: "الكل", count: reviews.length },
          { key: "pending", label: "⏳ بانتظار", count: reviews.filter((r) => r.status === "pending").length },
          { key: "approved", label: "✅ منشور", count: reviews.filter((r) => r.status === "approved").length },
          { key: "rejected", label: "❌ مرفوض", count: reviews.filter((r) => r.status === "rejected").length },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={{
              background: filter === f.key ? "rgba(196,16,64,0.15)" : "transparent",
              color: filter === f.key ? "#c41040" : "#71717a",
              border: `1px solid ${filter === f.key ? "rgba(196,16,64,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="⭐" title="لا توجد تقييمات" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
            return (
              <div key={r.id} className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="flex items-start gap-3">
                  {/* Rating */}
                  <div className="text-center flex-shrink-0" style={{ minWidth: 40 }}>
                    <div className="font-black text-brand" style={{ fontSize: 20 }}>{r.rating}</div>
                    <div style={{ fontSize: 10 }}>{"⭐".repeat(r.rating)}</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-xs">{r.customer_name}</span>
                      {r.verified_purchase && <span className="text-state-success text-[9px]">✅ مشترٍ</span>}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: st.color + "22", color: st.color }}>
                        {st.icon} {st.label}
                      </span>
                      <span className="text-muted text-[9px]">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                    </div>
                    {r.title && <div className="font-bold text-xs">{r.title}</div>}
                    {r.body && <p className="text-muted text-xs mt-0.5">{r.body}</p>}
                    {r.admin_reply && (
                      <div className="mt-1.5 bg-surface-elevated rounded-lg p-2 border-r-2 border-brand">
                        <span className="text-brand text-[9px] font-bold">ردك:</span>
                        <p className="text-xs">{r.admin_reply}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {r.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "approved")} className="text-state-success text-[10px] font-bold px-2 py-1 bg-surface-elevated rounded hover:bg-state-success/10">✅ موافقة</button>
                          <button onClick={() => updateStatus(r.id, "rejected")} className="text-state-error text-[10px] font-bold px-2 py-1 bg-surface-elevated rounded hover:bg-state-error/10">❌ رفض</button>
                        </>
                      )}
                      {r.status === "rejected" && (
                        <button onClick={() => updateStatus(r.id, "approved")} className="text-state-success text-[10px] font-bold px-2 py-1 bg-surface-elevated rounded">✅ نشر</button>
                      )}
                      {r.status === "approved" && (
                        <button onClick={() => updateStatus(r.id, "rejected")} className="text-state-error text-[10px] font-bold px-2 py-1 bg-surface-elevated rounded">❌ إخفاء</button>
                      )}
                      <button onClick={() => { setReplyReview(r); setReplyText(r.admin_reply || ""); }} className="text-brand text-[10px] font-bold px-2 py-1 bg-surface-elevated rounded">💬 رد</button>
                      <button onClick={() => setDeleteReview(r)} className="text-state-error text-[10px] font-bold px-2 py-1 bg-surface-elevated rounded">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply Modal */}
        <Modal open={!!replyReview} onClose={() => setReplyReview(null)} title="💬 رد على التقييم"
          footer={<button onClick={submitReply} className="btn-primary w-full text-sm py-2.5 rounded-xl font-bold">
            📤 إرسال الرد
          </button>}>
          {replyReview && <>
          <div className="mb-3 bg-surface-elevated rounded-lg p-3">
            <div className="font-bold text-xs text-right">{replyReview.customer_name} — {"⭐".repeat(replyReview.rating)}</div>
            {replyReview.body && <p className="text-muted text-xs text-right mt-1">{replyReview.body}</p>}
          </div>
          <FormField label="ردك">
            <textarea
              className="input text-xs min-h-[80px] resize-y"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="شكراً لتقييمك..."
              dir="auto"
            />
          </FormField>
          </>}
        </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
          open={!!deleteReview}
          title="حذف التقييم"
          message={`هل أنت متأكد من حذف تقييم "${deleteReview?.customer_name}"?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteReview(null)}
        />

      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
