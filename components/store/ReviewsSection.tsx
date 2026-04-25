"use client";

import { useEffect, useMemo, useState } from "react";
import { Quote, Star } from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

interface FeaturedReview {
  id: string;
  customer_name: string;
  rating: number;
  title?: string;
  body?: string;
  product_name: string;
  verified_purchase?: boolean;
  created_at: string;
}

export function ReviewsSection() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const [reviews, setReviews] = useState<FeaturedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/reviews/featured")
      .then((response) => response.json())
      .then((data) => {
        setReviews(data.reviews || []);
      })
      .catch((error) => {
        console.error("Reviews fetch error:", error);
        setReviews([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % reviews.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [reviews.length]);

  const summaryCopy = useMemo(
    () =>
      lang === "he"
        ? {
            badge: "חוות דעת לקוחות",
            subtitle:
              "אזור המלצות נקי ושקט שמציג ביטחון, שביעות רצון ואמון סביב המוצר והחנות.",
            verified: t("store2.verifiedPurchase"),
            scoreLabel: "דירוג ממוצע",
            countLabel: "ביקורות מוצגות",
          }
        : {
            badge: "آراء العملاء",
            subtitle:
              "مساحة تقييمات هادئة ومنظمة تعزز الثقة بالمحل وبالمنتج من دون ضجيج أو زحام بصري.",
            verified: t("store2.verifiedPurchase"),
            scoreLabel: "متوسط التقييم",
            countLabel: "مراجعات معروضة",
          },
    [lang, t]
  );

  if (loading || reviews.length === 0) return null;

  const review = reviews[index];
  const average =
    reviews.reduce((sum, current) => sum + current.rating, 0) / reviews.length;

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#2c2c35] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-[0_28px_60px_rgba(0,0,0,0.28)]">
      <div className="grid gap-5 px-5 py-5 md:px-7 md:py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[24px] border border-[#30303a] bg-white/[0.03] px-5 py-5">
            <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
              {summaryCopy.badge}
            </span>

            <h3
              className="mt-3 font-black text-white"
              style={{ fontSize: scr.mobile ? 20 : 28 }}
            >
              {t("store2.reviews")}
            </h3>

            <p className="mt-3 text-sm leading-8 text-[#b8b8c2]">
              {summaryCopy.subtitle}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] border border-[#30303a] bg-white/[0.03] px-5 py-4">
              <div className="text-xs font-semibold text-[#9d9daa]">
                {summaryCopy.scoreLabel}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="text-3xl font-black text-white">
                  {average.toFixed(1)}
                </div>
                <div className="flex items-center gap-1 text-[#ff3351]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={15}
                      fill={star <= Math.round(average) ? "currentColor" : "none"}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#30303a] bg-white/[0.03] px-5 py-4">
              <div className="text-xs font-semibold text-[#9d9daa]">
                {summaryCopy.countLabel}
              </div>
              <div className="mt-2 text-3xl font-black text-white">
                {reviews.length}
              </div>
            </div>
          </div>
        </aside>

        <article className="relative overflow-hidden rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(17,17,21,0.98))] px-5 py-5 shadow-[0_20px_45px_rgba(0,0,0,0.24)] md:px-6 md:py-6">
          <div className="absolute left-5 top-5 flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#ff3351]/20 bg-[#ff3351]/10 text-[#ff7790]">
            <Quote size={20} />
          </div>

          <div className="pr-0 pt-14 md:pt-12">
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={scr.mobile ? 16 : 18}
                  className={star <= review.rating ? "text-[#ff3351]" : "text-[#4a4a54]"}
                  fill={star <= review.rating ? "currentColor" : "none"}
                />
              ))}

              {review.verified_purchase && (
                <span className="inline-flex rounded-full border border-[#1f6d47] bg-[#0d2419] px-3 py-1 text-[11px] font-semibold text-[#8ce2ae]">
                  {summaryCopy.verified}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-lg font-black text-white md:text-xl">
                {review.customer_name}
              </span>
              <span className="inline-flex rounded-full border border-[#30303a] bg-[#141419] px-3 py-1 text-xs text-[#b8b8c2]">
                {review.product_name}
              </span>
            </div>

            {review.title && (
              <div className="mt-5 text-lg font-bold text-[#f1f1f4]">
                {review.title}
              </div>
            )}

            {review.body && (
              <p className="mt-4 max-w-3xl text-sm leading-8 text-[#c7c7d0] md:text-base">
                {review.body}
              </p>
            )}
          </div>

          {reviews.length > 1 && (
            <div className="mt-8 flex items-center justify-between gap-4 border-t border-[#26262e] pt-4">
              <div className="flex items-center gap-2">
                {reviews.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`${itemIndex + 1}`}
                    className="transition-all"
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: index === itemIndex ? 28 : 8,
                        height: 8,
                        background:
                          index === itemIndex ? "#ff3351" : "rgba(255,255,255,0.18)",
                      }}
                    />
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-[#8f8f99]">
                {index + 1} / {reviews.length}
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
