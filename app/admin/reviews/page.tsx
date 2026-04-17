"use client";

export const dynamic = 'force-dynamic';

// =====================================================
// ClalMobile — Admin Reviews Moderation + AI Generator
// Approve, reject, reply to product reviews
// Generate realistic AI reviews with Arab + Jewish Israeli names
// =====================================================

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader, Modal, FormField, EmptyState, ConfirmDialog } from "@/components/admin/shared";
import type { Product } from "@/types/database";
import { csrfHeaders } from "@/lib/csrf-client";

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

  // AI Generator state
  const [products, setProducts] = useState<Product[]>([]);
  const [genProduct, setGenProduct] = useState("");
  const [genCount, setGenCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [manualDist, setManualDist] = useState(false);
  const [dist, setDist] = useState({ star5: 6, star4: 3, star3: 1, star2: 0, star1: 0 });

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      const json = await res.json();
      setProducts(json.products || json.data || []);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews?admin=true");
      const json = await res.json();
      setReviews(json.reviews || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadProducts(); }, [load, loadProducts]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/reviews", {
        method: "PUT",
        headers: csrfHeaders(),
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
        headers: csrfHeaders(),
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
      await fetch(`/api/reviews?id=${deleteReview.id}`, { method: "DELETE", headers: csrfHeaders() });
      show("🗑️ تم الحذف");
      setDeleteReview(null);
      load();
    } catch {
      show("❌ خطأ", "error");
    }
  };

  const handleGenerate = async () => {
    const total = manualDist ? dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1 : genCount;
    if (!genProduct || total < 1) return;
    setGenerating(true);
    try {
      const payload: any = { product_id: genProduct, count: total };
      if (manualDist) payload.distribution = dist;
      const res = await fetch("/api/admin/reviews/generate", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      show(`✅ تم توليد ${json.count} تقييم بنجاح!`);
      setShowGenerator(false);
      load();
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    }
    setGenerating(false);
  };

  const handleDeleteProductReviews = async (productId: string) => {
    try {
      const productReviews = reviews.filter(r => r.product_id === productId);
      for (const r of productReviews) {
        await fetch(`/api/reviews?id=${r.id}`, { method: "DELETE", headers: csrfHeaders() });
      }
      show(`🗑️ تم حذف ${productReviews.length} تقييم`);
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

      {/* AI Review Generator Toggle */}
      <button
        onClick={() => setShowGenerator(!showGenerator)}
        className="w-full mb-3 py-2.5 rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        style={{
          background: showGenerator ? "rgba(196,16,64,0.15)" : "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
          color: showGenerator ? "#c41040" : "white",
          border: showGenerator ? "1.5px solid rgba(196,16,64,0.3)" : "none",
          fontSize: scr.mobile ? 12 : 14,
        }}
      >
        {showGenerator ? "✕ إغلاق المولّد" : "🤖 توليد تقييمات ذكية"}
      </button>

      {/* Generator Panel */}
      {showGenerator && (
        <div className="card mb-3" style={{ padding: scr.mobile ? 12 : 16 }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <h3 className="font-extrabold text-sm">مولّد التقييمات الذكي</h3>
              <p className="text-muted text-[10px]">الذكاء يكتب تقييمات واقعية بأسماء عرب 48 — تتكلم عن المنتج والخدمة والتوصيل</p>
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "2fr 1fr" }}>
            <FormField label="اختر المنتج">
              <select
                className="input text-xs"
                value={genProduct}
                onChange={(e) => setGenProduct(e.target.value)}
              >
                <option value="">— اختر منتج —</option>
                {products.filter(p => p.active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} — {p.name_ar} {(() => {
                      const rc = reviews.filter(r => r.product_id === p.id).length;
                      return rc > 0 ? `(${rc} تقييم)` : "";
                    })()}
                  </option>
                ))}
              </select>
            </FormField>
            {!manualDist && (
              <FormField label="عدد التقييمات">
                <input
                  type="number"
                  className="input text-xs"
                  value={genCount}
                  onChange={(e) => setGenCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={50}
                />
              </FormField>
            )}
          </div>

          {/* Distribution: Auto vs Manual toggle */}
          {genProduct && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setManualDist(false)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                  style={{
                    background: !manualDist ? "rgba(196,16,64,0.15)" : "transparent",
                    color: !manualDist ? "#c41040" : "#71717a",
                    border: `1px solid ${!manualDist ? "rgba(196,16,64,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  🎲 توزيع تلقائي
                </button>
                <button
                  onClick={() => setManualDist(true)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                  style={{
                    background: manualDist ? "rgba(196,16,64,0.15)" : "transparent",
                    color: manualDist ? "#c41040" : "#71717a",
                    border: `1px solid ${manualDist ? "rgba(196,16,64,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  ✏️ توزيع يدوي
                </button>
              </div>

              {manualDist ? (
                <div className="bg-surface-elevated rounded-lg p-2.5">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                    {([
                      { key: "star5" as const, label: "5 ⭐", clr: "#22c55e" },
                      { key: "star4" as const, label: "4 ⭐", clr: "#84cc16" },
                      { key: "star3" as const, label: "3 ⭐", clr: "#f59e0b" },
                      { key: "star2" as const, label: "2 ⭐", clr: "#f97316" },
                      { key: "star1" as const, label: "1 ⭐", clr: "#ef4444" },
                    ]).map(s => (
                      <div key={s.key} className="text-center">
                        <div className="text-[10px] font-bold mb-0.5" style={{ color: s.clr }}>{s.label}</div>
                        <input
                          type="number"
                          className="input text-xs text-center w-full"
                          value={dist[s.key]}
                          onChange={(e) => setDist(prev => ({ ...prev, [s.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          min={0}
                          max={50}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-center mt-1.5 text-[10px] font-bold" style={{ color: (dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1) > 50 ? "#ef4444" : "#71717a" }}>
                    المجموع: {dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1} تقييم
                    {(dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1) > 50 && " ⚠️ الحد الأقصى 50"}
                  </div>
                </div>
              ) : (
                <div className="bg-surface-elevated rounded-lg p-2.5 text-[10px]">
                  <div className="font-bold mb-1">📊 التوزيع التقريبي:</div>
                  <div className="flex gap-3 flex-wrap text-muted">
                    <span>⭐⭐⭐⭐⭐ ~{Math.round(genCount * 0.45)}</span>
                    <span>⭐⭐⭐⭐ ~{Math.round(genCount * 0.30)}</span>
                    <span>⭐⭐⭐ ~{Math.round(genCount * 0.15)}</span>
                    <span>⭐⭐ ~{Math.round(genCount * 0.08)}</span>
                    <span>⭐ ~{Math.max(0, genCount - Math.round(genCount * 0.45) - Math.round(genCount * 0.30) - Math.round(genCount * 0.15) - Math.round(genCount * 0.08))}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleGenerate}
              disabled={generating || !genProduct || (manualDist ? (dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1) < 1 || (dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1) > 50 : genCount < 1)}
              className="flex-1 py-2.5 rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                color: "white",
                border: "none",
                fontSize: scr.mobile ? 12 : 13,
              }}
            >
              {generating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  جاري التوليد...
                </>
              ) : (
                <>🤖 ولّد {manualDist ? dist.star5 + dist.star4 + dist.star3 + dist.star2 + dist.star1 : genCount} تقييم</>
              )}
            </button>

            {/* Delete all reviews for selected product */}
            {genProduct && reviews.filter(r => r.product_id === genProduct).length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`حذف جميع تقييمات هذا المنتج (${reviews.filter(r => r.product_id === genProduct).length} تقييم)؟`)) {
                    handleDeleteProductReviews(genProduct);
                  }
                }}
                className="px-3 py-2.5 rounded-xl font-bold cursor-pointer text-state-error bg-surface-elevated text-[11px]"
              >
                🗑️ حذف الكل ({reviews.filter(r => r.product_id === genProduct).length})
              </button>
            )}
          </div>
        </div>
      )}

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
            const prod = products.find(p => p.id === r.product_id);
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
                      {prod && <span className="text-[9px] text-muted">📱 {prod.brand} {prod.name_ar}</span>}
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
