"use client";

import { useState, useEffect } from "react";
import { useScreen } from "@/lib/hooks";

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
  const [reviews, setReviews] = useState<FeaturedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/reviews/featured")
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews || []);
      })
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || reviews.length === 0) return null;

  const review = reviews[index];
  const showCarousel = reviews.length > 1;

  return (
    <div className="mb-6">
      <h3 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 18 }}>
        ⭐ آراء الزبائن
      </h3>
      <div className="bg-surface-elevated rounded-xl border border-surface-border overflow-hidden" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="text-right">
          <div className="flex items-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className="text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                {s <= review.rating ? "★" : "☆"}
              </span>
            ))}
            {review.verified_purchase && (
              <span className="text-state-success text-[10px] mr-1">✓ شراء موثق</span>
            )}
          </div>
          <div className="font-bold text-sm mb-0.5">{review.customer_name}</div>
          <div className="text-muted text-[10px] mb-1.5">{review.product_name}</div>
          {review.title && <div className="font-semibold text-xs mb-1">{review.title}</div>}
          {review.body && (
            <p className="text-muted text-xs leading-relaxed" style={{ maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>
              {review.body}
            </p>
          )}
        </div>
        {showCarousel && (
          <div className="flex justify-center gap-1 mt-3">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className="w-2 h-2 rounded-full transition-colors cursor-pointer"
                style={{ background: i === index ? "#c41040" : "#3f3f46" }}
                aria-label={`عرض تقييم ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
