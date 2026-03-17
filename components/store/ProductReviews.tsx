"use client";

// =====================================================
// ClalMobile — Product Reviews Component
// Display reviews + submit form on product detail page
// =====================================================

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  title?: string;
  body?: string;
  verified_purchase: boolean;
  admin_reply?: string;
  created_at: string;
}

export function ProductReviews({ productId }: { productId: string }) {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Check feature flag
        const settingsRes = await fetch("/api/admin/settings");
        const settingsJson = await settingsRes.json();
        if (settingsJson.settings?.feature_reviews !== "true") {
          setEnabled(false);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/reviews?product_id=${productId}`);
        const json = await res.json();
        setReviews(json.reviews || []);
        setAvg(json.avg || 0);
        setCount(json.count || 0);
      } catch {}
      setLoading(false);
    }
    load();
  }, [productId]);

  const handleSubmit = async () => {
    if (!name.trim()) { show("يرجى إدخال اسمك", "error"); return; }
    if (rating < 1 || rating > 5) { show("يرجى اختيار تقييم", "error"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          customer_name: name,
          customer_phone: phone || undefined,
          rating,
          title: title || undefined,
          body: body || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        show(json.error === "Already reviewed" ? "قمت بتقييم هذا المنتج مسبقاً" : json.error, "error");
      } else {
        show("✅ شكراً! سيتم نشر تقييمك بعد الموافقة");
        setShowForm(false);
        setName(""); setPhone(""); setRating(5); setTitle(""); setBody("");
      }
    } catch {
      show("حدث خطأ", "error");
    }
    setSubmitting(false);
  };

  if (!enabled || loading) return null;

  const Stars = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-0.5" style={{ direction: "ltr" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          className="transition-transform"
          style={{
            fontSize: scr.mobile ? 18 : 22,
            cursor: onChange ? "pointer" : "default",
            transform: onChange && i === value ? "scale(1.2)" : "scale(1)",
          }}
        >
          {i <= value ? "⭐" : "☆"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="card mt-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-xs px-3 py-1.5 rounded-lg"
        >
          ✍️ أضف تقييم
        </button>
        <div className="text-right">
          <h3 className="font-extrabold" style={{ fontSize: scr.mobile ? 13 : 16 }}>
            ⭐ التقييمات ({count})
          </h3>
          {count > 0 && (
            <div className="flex items-center gap-1.5 justify-end">
              <Stars value={Math.round(avg)} />
              <span className="text-muted text-xs">{avg}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Submit Form */}
      {showForm && (
        <div className="bg-surface-elevated rounded-xl p-3 mb-3 space-y-2.5">
          <div className="text-right">
            <label className="text-xs font-bold text-muted">التقييم</label>
            <Stars value={rating} onChange={setRating} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-muted">الاسم *</label>
              <input className="input text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" dir="auto" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted">هاتف (اختياري)</label>
              <input className="input text-xs" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05X-XXXXXXX" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted">عنوان التقييم</label>
            <input className="input text-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ممتاز!" dir="auto" />
          </div>

          <div>
            <label className="text-xs font-bold text-muted">التفاصيل</label>
            <textarea
              className="input text-xs min-h-[60px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="شاركنا تجربتك..."
              dir="auto"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full text-xs py-2 rounded-lg disabled:opacity-50"
          >
            {submitting ? "⏳ جاري الإرسال..." : "📤 إرسال التقييم"}
          </button>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 && !showForm && (
        <p className="text-muted text-center text-xs py-4">لا توجد تقييمات بعد — كن أول من يقيّم!</p>
      )}

      <div className="space-y-2.5">
        {reviews.map((r) => (
          <div key={r.id} className="bg-surface-elevated rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Stars value={r.rating} />
                {r.verified_purchase && (
                  <span className="text-state-success text-[9px] font-bold">✅ مشترٍ حقيقي</span>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold text-xs">{r.customer_name}</span>
                <span className="text-muted text-[9px] mr-2">
                  {new Date(r.created_at).toLocaleDateString("ar")}
                </span>
              </div>
            </div>
            {r.title && <div className="font-bold text-xs text-right mb-0.5">{r.title}</div>}
            {r.body && <p className="text-muted text-xs text-right">{r.body}</p>}
            {r.admin_reply && (
              <div className="mt-2 bg-surface-card rounded-lg p-2 border-r-2 border-brand">
                <span className="text-brand text-[9px] font-bold">رد ClalMobile:</span>
                <p className="text-xs text-right">{r.admin_reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Toast */}
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
