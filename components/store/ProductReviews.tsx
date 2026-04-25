"use client";

// =====================================================
// ClalMobile — Product Reviews Component
// Display reviews + submit form on product detail page
// =====================================================

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { csrfHeaders } from "@/lib/csrf-client";

function Stars({ value, onChange, mobile }: { value: number; onChange?: (v: number) => void; mobile?: boolean }) {
  return (
    <div className="flex gap-0.5" style={{ direction: "ltr" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          className="transition-transform"
          style={{
            fontSize: mobile ? 18 : 22,
            cursor: onChange ? "pointer" : "default",
            transform: onChange && i === value ? "scale(1.2)" : "scale(1)",
          }}
        >
          {i <= value ? "⭐" : "☆"}
        </button>
      ))}
    </div>
  );
}

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
  const shellClass =
    "rounded-[28px] border border-[#33333c] bg-[linear-gradient(180deg,#1b1b20_0%,#131317_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.22)] md:px-6 md:py-6";
  const softCardClass = "rounded-2xl border border-[#30303a] bg-white/[0.03]";
  const labelClass = "mb-1.5 block text-xs font-bold text-[#8f8f99]";
  const inputClass =
    "w-full rounded-2xl border border-[#3a3a44] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#8f8f99] focus:border-[#ff3351]/45 focus:bg-white/[0.05]";
  const primaryButtonClass =
    "inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f] disabled:cursor-not-allowed disabled:opacity-60";

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
        const rd = json.data ?? json;
        setReviews(rd.reviews || []);
        setAvg(rd.avg || 0);
        setCount(rd.count || 0);
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
        headers: csrfHeaders(),
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

  return (
    <div className={`${shellClass} mt-4`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className={primaryButtonClass}
        >
          {showForm ? "إغلاق النموذج" : "أضف تقييم"}
        </button>
        <div className="text-right">
          <h3 className="font-extrabold text-white" style={{ fontSize: scr.mobile ? 13 : 16 }}>
            التقييمات ({count})
          </h3>
          {count > 0 && (
            <div className="flex items-center gap-1.5 justify-end">
              <Stars value={Math.round(avg)} mobile={scr.mobile} />
              <span className="text-xs text-[#b8b8c2]">{avg}/5</span>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className={`${softCardClass} mb-4 space-y-3 p-4`}>
          <div className="text-right">
            <label className={labelClass}>التقييم</label>
            <Stars value={rating} onChange={setRating} mobile={scr.mobile} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>الاسم *</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك"
                dir="auto"
              />
            </div>
            <div>
              <label className={labelClass}>هاتف (اختياري)</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>عنوان التقييم</label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ممتاز!"
              dir="auto"
            />
          </div>

          <div>
            <label className={labelClass}>التفاصيل</label>
            <textarea
              className={`${inputClass} min-h-[90px] resize-y`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="شاركنا تجربتك..."
              dir="auto"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`${primaryButtonClass} w-full`}
          >
            {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
          </button>
        </div>
      )}

      {reviews.length === 0 && !showForm && (
        <p className="py-4 text-center text-xs text-[#b8b8c2]">
          لا توجد تقييمات بعد، كن أول من يشارك رأيه.
        </p>
      )}

      <div className="space-y-2.5">
        {reviews.map((r) => (
          <div key={r.id} className={`${softCardClass} p-4`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Stars value={r.rating} mobile={scr.mobile} />
                {r.verified_purchase && (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    مشترٍ حقيقي
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-white">{r.customer_name}</span>
                <span className="me-2 text-[9px] text-[#8f8f99]">
                  {new Date(r.created_at).toLocaleDateString("ar")}
                </span>
              </div>
            </div>
            {r.title && <div className="mb-0.5 text-right text-xs font-bold text-white">{r.title}</div>}
            {r.body && <p className="text-right text-xs leading-7 text-[#b8b8c2]">{r.body}</p>}
            {r.admin_reply && (
              <div className="mt-3 rounded-2xl border border-[#ff3351]/18 bg-[#ff3351]/08 p-3 text-right">
                <span className="text-[10px] font-bold text-[#ff8da0]">رد ClalMobile:</span>
                <p className="mt-1 text-xs leading-7 text-[#f0f0f4]">{r.admin_reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fixed bottom-5 left-1/2 z-[999] -translate-x-1/2 rounded-2xl border px-6 py-3 text-sm font-bold shadow-2xl ${
            t.type === "error"
              ? "border-[#6a2232] bg-[#2a1016] text-[#ff8da0]"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
