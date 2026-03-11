"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, ChevronDown, CheckCircle2, MessageSquare, Send, User } from "lucide-react";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

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

type SortMode = "newest" | "highest" | "lowest";

export function ProductReviews({ productId }: { productId: string }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const { toasts, show } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  });
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<SortMode>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ratingError, setRatingError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
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
        if (json.distribution) setDistribution(json.distribution);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, [productId]);

  const sorted = useCallback(() => {
    const list = [...reviews];
    switch (sort) {
      case "highest":
        return list.sort((a, b) => b.rating - a.rating);
      case "lowest":
        return list.sort((a, b) => a.rating - b.rating);
      default:
        return list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [reviews, sort]);

  const handleSubmit = async () => {
    if (rating < 1) {
      setRatingError(true);
      show(t("store2.ratingRequired"), "error");
      return;
    }
    if (!name.trim()) {
      show(t("store2.reviewError"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          customer_name: name.trim(),
          customer_phone: phone.trim() || undefined,
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        show(json.error || t("store2.reviewError"), "error");
      } else {
        show(t("store2.reviewSubmitted"), "success");
        setShowForm(false);
        setName("");
        setPhone("");
        setRating(0);
        setTitle("");
        setBody("");
        setRatingError(false);
      }
    } catch {
      show(t("store2.reviewError"), "error");
    }
    setSubmitting(false);
  };

  if (!enabled || loading) return null;

  const dateLocale = lang === "he" ? "he-IL" : "ar-SA";
  const maxDist = Math.max(...Object.values(distribution), 1);

  const StarIcon = ({
    filled,
    size = 16,
    className = "",
  }: {
    filled: boolean;
    size?: number;
    className?: string;
  }) => (
    <Star
      size={size}
      className={`${filled ? "text-brand" : "text-dim"} ${className}`}
      fill={filled ? "currentColor" : "none"}
      strokeWidth={filled ? 0 : 1.5}
    />
  );

  const StarRating = ({
    value,
    size = 16,
  }: {
    value: number;
    size?: number;
  }) => (
    <div className="flex gap-0.5" style={{ direction: "ltr" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} filled={i <= value} size={size} />
      ))}
    </div>
  );

  const sortLabel: Record<SortMode, string> = {
    newest: t("store2.sortNewest"),
    highest: t("store2.sortHighest"),
    lowest: t("store2.sortLowest"),
  };

  return (
    <section className="mt-6">
      {/* ── Rating Summary ── */}
      <div
        className="rounded-2xl overflow-hidden border border-glass-border"
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(16px)",
          padding: scr.mobile ? 16 : 24,
        }}
      >
        <h3
          className="font-extrabold text-white mb-4"
          style={{ fontSize: scr.mobile ? 15 : 20 }}
        >
          {t("store2.reviews")}
        </h3>

        <div className={`flex ${scr.mobile ? "flex-col gap-4" : "gap-8 items-start"}`}>
          {/* Left: big average */}
          <div className="flex flex-col items-center" style={{ minWidth: scr.mobile ? "auto" : 120 }}>
            <span
              className="font-black text-white leading-none"
              style={{ fontSize: scr.mobile ? 48 : 60 }}
            >
              {avg > 0 ? avg.toFixed(1) : "—"}
            </span>
            <StarRating value={Math.round(avg)} size={scr.mobile ? 16 : 20} />
            <span
              className="text-muted font-semibold mt-1"
              style={{ fontSize: scr.mobile ? 11 : 13 }}
            >
              {count} {t("store2.reviews").toLowerCase()}
            </span>
          </div>

          {/* Right: distribution bars */}
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const pct = count > 0 ? (distribution[star] / count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-0.5 flex-shrink-0"
                    style={{ width: scr.mobile ? 24 : 30, direction: "ltr" }}
                  >
                    <span
                      className="text-white font-bold"
                      style={{ fontSize: scr.mobile ? 11 : 13 }}
                    >
                      {star}
                    </span>
                    <Star size={scr.mobile ? 10 : 12} className="text-brand" fill="currentColor" strokeWidth={0} />
                  </div>
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{
                      height: scr.mobile ? 6 : 8,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${(distribution[star] / maxDist) * 100}%`,
                        background: "linear-gradient(90deg, #c41040, #ff3366)",
                        minWidth: distribution[star] > 0 ? 4 : 0,
                      }}
                    />
                  </div>
                  <span
                    className="text-muted font-semibold flex-shrink-0"
                    style={{
                      fontSize: scr.mobile ? 10 : 12,
                      width: scr.mobile ? 32 : 40,
                      textAlign: "start",
                    }}
                  >
                    {pct > 0 ? `${Math.round(pct)}%` : "0%"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Actions: Sort + Write Review ── */}
      <div className="flex items-center justify-between mt-4 mb-3 gap-2">
        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-glass-border px-3 py-1.5 text-white font-semibold transition-colors hover:bg-glass-hover"
            style={{
              fontSize: scr.mobile ? 11 : 13,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            {sortLabel[sort]}
            <ChevronDown
              size={14}
              className={`transition-transform ${sortOpen ? "rotate-180" : ""}`}
            />
          </button>
          {sortOpen && (
            <div
              className="absolute z-20 mt-1 rounded-xl border border-glass-border shadow-glass-lg overflow-hidden animate-scale-in"
              style={{
                background: "#18181b",
                minWidth: 140,
                [lang === "he" ? "left" : "right"]: 0,
              }}
            >
              {(["newest", "highest", "lowest"] as SortMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSort(s);
                    setSortOpen(false);
                  }}
                  className={`block w-full text-start px-4 py-2 font-semibold transition-colors ${
                    sort === s ? "text-brand bg-brand-soft" : "text-white hover:bg-glass-hover"
                  }`}
                  style={{ fontSize: scr.mobile ? 11 : 13 }}
                >
                  {sortLabel[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl font-bold text-white transition-all active:scale-95"
          style={{
            fontSize: scr.mobile ? 11 : 13,
            padding: scr.mobile ? "6px 14px" : "8px 18px",
            background: "linear-gradient(135deg, #c41040, #ff3366)",
            boxShadow: "0 4px 16px rgba(196,16,64,0.3)",
          }}
        >
          <Send size={14} />
          {t("store2.writeReview")}
        </button>
      </div>

      {/* ── Write Review Form ── */}
      {showForm && (
        <div
          className="rounded-2xl border border-glass-border overflow-hidden mb-4 animate-scale-in"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(16px)",
            padding: scr.mobile ? 16 : 24,
          }}
        >
          <h4
            className="font-bold text-white mb-4"
            style={{ fontSize: scr.mobile ? 14 : 16 }}
          >
            {t("store2.writeReview")}
          </h4>

          {/* Star selector */}
          <div className="mb-4">
            <div
              className="flex gap-1 items-center"
              style={{ direction: "ltr" }}
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setRating(i);
                    setRatingError(false);
                  }}
                  onMouseEnter={() => setHoverRating(i)}
                  className="transition-transform hover:scale-125 cursor-pointer"
                  style={{ padding: 2 }}
                >
                  <Star
                    size={scr.mobile ? 28 : 34}
                    className={`transition-colors ${
                      i <= (hoverRating || rating) ? "text-brand" : "text-dim"
                    }`}
                    fill={i <= (hoverRating || rating) ? "currentColor" : "none"}
                    strokeWidth={i <= (hoverRating || rating) ? 0 : 1.5}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span
                  className="text-muted font-bold ms-2"
                  style={{ fontSize: scr.mobile ? 13 : 15 }}
                >
                  {rating}/5
                </span>
              )}
            </div>
            {ratingError && (
              <p className="text-state-error text-xs font-semibold mt-1 animate-fade-in">
                {t("store2.ratingRequired")}
              </p>
            )}
          </div>

          {/* Name & Phone */}
          <div className={`grid ${scr.mobile ? "grid-cols-1" : "grid-cols-2"} gap-3 mb-3`}>
            <div>
              <label
                className="text-muted text-xs font-bold mb-1 block"
              >
                {t("store2.reviewName")} *
              </label>
              <div className="relative">
                <User
                  size={14}
                  className="absolute top-1/2 -translate-y-1/2 text-dim"
                  style={{ [lang === "he" ? "left" : "right"]: 12 }}
                />
                <input
                  className="w-full rounded-xl border border-glass-border bg-glass-bg text-white text-sm font-medium outline-none transition-all focus:border-brand placeholder:text-dim"
                  style={{
                    padding: scr.mobile ? "8px 12px" : "10px 14px",
                    [lang === "he" ? "paddingLeft" : "paddingRight"]: 34,
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("store2.reviewName")}
                  dir="auto"
                />
              </div>
            </div>
            <div>
              <label className="text-muted text-xs font-bold mb-1 block">
                {lang === "he" ? "טלפון (אופציונלי)" : "هاتف (اختياري)"}
              </label>
              <input
                className="w-full rounded-xl border border-glass-border bg-glass-bg text-white text-sm font-medium outline-none transition-all focus:border-brand placeholder:text-dim"
                style={{ padding: scr.mobile ? "8px 12px" : "10px 14px" }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
              />
            </div>
          </div>

          {/* Title */}
          <div className="mb-3">
            <label className="text-muted text-xs font-bold mb-1 block">
              {t("store2.reviewTitle")}
            </label>
            <input
              className="w-full rounded-xl border border-glass-border bg-glass-bg text-white text-sm font-medium outline-none transition-all focus:border-brand placeholder:text-dim"
              style={{ padding: scr.mobile ? "8px 12px" : "10px 14px" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("store2.reviewTitle")}
              dir="auto"
            />
          </div>

          {/* Body */}
          <div className="mb-4">
            <label className="text-muted text-xs font-bold mb-1 block">
              {t("store2.reviewBody")}
            </label>
            <textarea
              className="w-full rounded-xl border border-glass-border bg-glass-bg text-white text-sm font-medium outline-none transition-all focus:border-brand placeholder:text-dim resize-y"
              style={{
                padding: scr.mobile ? "8px 12px" : "10px 14px",
                minHeight: 80,
              }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("store2.reviewBody")}
              dir="auto"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              padding: scr.mobile ? "10px 0" : "12px 0",
              fontSize: scr.mobile ? 13 : 15,
              background: "linear-gradient(135deg, #c41040, #ff3366)",
              boxShadow: submitting ? "none" : "0 4px 16px rgba(196,16,64,0.3)",
            }}
          >
            {submitting ? (
              <>
                <span
                  className="inline-block border-2 border-white/30 border-t-white rounded-full animate-spin"
                  style={{ width: 16, height: 16 }}
                />
                {t("store2.submitting")}
              </>
            ) : (
              <>
                <Send size={16} />
                {t("store2.submitReview")}
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Reviews List ── */}
      {reviews.length === 0 && !showForm && (
        <div
          className="rounded-2xl border border-glass-border text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: scr.mobile ? "32px 16px" : "48px 24px",
          }}
        >
          <Star size={32} className="text-dim mx-auto mb-3" />
          <p
            className="text-muted font-semibold"
            style={{ fontSize: scr.mobile ? 12 : 14 }}
          >
            {t("store2.noReviews")}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sorted().map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-glass-border overflow-hidden transition-all hover:border-glass-hover animate-fade-in"
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: scr.mobile ? 14 : 20,
            }}
          >
            {/* Review header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                  style={{
                    width: scr.mobile ? 32 : 38,
                    height: scr.mobile ? 32 : 38,
                    background: "linear-gradient(135deg, #c41040, #ff3366)",
                    fontSize: scr.mobile ? 13 : 15,
                  }}
                >
                  {r.customer_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-bold text-white"
                      style={{ fontSize: scr.mobile ? 12 : 14 }}
                    >
                      {r.customer_name}
                    </span>
                    {r.verified_purchase && (
                      <span className="flex items-center gap-0.5 text-state-success">
                        <CheckCircle2 size={scr.mobile ? 11 : 13} />
                        <span
                          className="font-semibold"
                          style={{ fontSize: scr.mobile ? 9 : 10 }}
                        >
                          {t("store2.verifiedPurchase")}
                        </span>
                      </span>
                    )}
                  </div>
                  <span
                    className="text-muted"
                    style={{ fontSize: scr.mobile ? 10 : 11 }}
                  >
                    {new Date(r.created_at).toLocaleDateString(dateLocale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <StarRating value={r.rating} size={scr.mobile ? 12 : 14} />
            </div>

            {/* Title + body */}
            {r.title && (
              <h5
                className="font-bold text-white mb-1"
                style={{ fontSize: scr.mobile ? 12 : 14 }}
              >
                {r.title}
              </h5>
            )}
            {r.body && (
              <p
                className="text-muted leading-relaxed"
                style={{ fontSize: scr.mobile ? 12 : 13 }}
              >
                {r.body}
              </p>
            )}

            {/* Admin reply */}
            {r.admin_reply && (
              <div
                className="mt-3 rounded-xl border-s-2 border-brand"
                style={{
                  background: "rgba(196,16,64,0.06)",
                  padding: scr.mobile ? "8px 12px" : "10px 16px",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare size={12} className="text-brand" />
                  <span
                    className="text-brand font-bold"
                    style={{ fontSize: scr.mobile ? 10 : 11 }}
                  >
                    {t("store2.adminReply")}
                  </span>
                </div>
                <p
                  className="text-white/80"
                  style={{ fontSize: scr.mobile ? 12 : 13 }}
                >
                  {r.admin_reply}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Toast notifications ── */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed z-toast bottom-5 left-1/2 -translate-x-1/2 rounded-xl border font-bold shadow-2xl animate-slide-up"
          style={{
            background: "#18181b",
            borderColor: toast.type === "error" ? "#ef4444" : "#22c55e",
            color: toast.type === "error" ? "#ef4444" : "#22c55e",
            padding: "10px 20px",
            fontSize: scr.mobile ? 12 : 14,
          }}
        >
          {toast.message}
        </div>
      ))}
    </section>
  );
}
