"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import type { Hero } from "@/types/database";

// Fallback heroes when DB is empty
const FALLBACK_HEROES: Hero[] = [
  {
    id: "h1", title_ar: "عروض الصيف 🔥", title_he: "מבצעי קיץ 🔥", subtitle_ar: "خصومات حتى 40% على أجهزة Samsung",
    subtitle_he: "הנחות עד 40% על מכשירי Samsung", image_url: "", link_url: "", cta_text_ar: "تسوّق الآن", cta_text_he: "קנה עכשיו", sort_order: 1, active: true, created_at: "",
  },
  {
    id: "h2", title_ar: "iPhone 17 وصل!", title_he: "iPhone 17 הגיע!", subtitle_ar: "اطلب الآن واحصل على كفر MagSafe مجاناً",
    subtitle_he: "הזמן עכשיו וקבל כיסוי MagSafe במתנה", image_url: "", link_url: "", cta_text_ar: "اطلب الآن", cta_text_he: "הזמן עכשיו", sort_order: 2, active: true, created_at: "",
  },
];

export function HeroCarousel({ heroes }: { heroes?: Hero[] }) {
  const scr = useScreen();
  const { lang } = useLang();
  const items = heroes && heroes.length > 0 ? heroes : FALLBACK_HEROES;
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) > 50) {
      if (delta > 0) {
        setIdx((i) => (i + 1) % items.length);
      } else {
        setIdx((i) => (i - 1 + items.length) % items.length);
      }
    }
  };

  const h = items[idx];
  const title = lang === "he" ? (h.title_he || h.title_ar) : h.title_ar;
  const subtitle = lang === "he" ? (h.subtitle_he || h.subtitle_ar) : h.subtitle_ar;
  const ctaText = lang === "he" ? (h.cta_text_he || h.cta_text_ar) : h.cta_text_ar;

  return (
    <div
      className="text-center relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="عروض مميزة"
      style={{
        position: "relative",
        background: "transparent",
        padding: scr.mobile ? "24px 20px" : "48px 40px",
        minHeight: scr.mobile ? 280 : 400,
        maxWidth: 1200,
        marginLeft: "auto",
        marginRight: "auto",
        borderRadius: scr.mobile ? 0 : 20,
        margin: scr.mobile ? 0 : "0 0 20px",
        overflow: "hidden",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {h.image_url && (
        <Image
          src={h.image_url}
          alt=""
          fill
          sizes="100vw"
          className="object-cover rounded-[inherit]"
          priority={idx === 0}
        />
      )}
      <div
        className="glass-card-static relative z-10"
        style={{
          padding: scr.mobile ? "20px 16px" : "32px 28px",
          maxWidth: 600,
          margin: "0 auto",
        }}
        aria-live="polite"
      >
        <h2
          className="font-black mb-1.5"
          style={{ fontSize: scr.mobile ? 20 : 32 }}
        >
          {title}
        </h2>
        <p
          className="text-muted mb-3"
          style={{ fontSize: scr.mobile ? 11 : 16 }}
        >
          {subtitle}
        </p>
        {ctaText && (
          h.link_url ? (
            <Link
              href={h.link_url}
              className="btn-primary inline-block"
              style={{
                padding: scr.mobile ? "10px 28px" : "12px 36px",
                fontSize: scr.mobile ? 12 : 14,
              }}
            >
              {ctaText}
            </Link>
          ) : (
            <button
              className="btn-primary opacity-50 cursor-not-allowed"
              disabled
              style={{
                padding: scr.mobile ? "10px 28px" : "12px 36px",
                fontSize: scr.mobile ? 12 : 14,
              }}
            >
              {ctaText}
            </button>
          )
        )}
      </div>
      {items.length > 1 && (
        <div className="glass flex justify-center gap-1.5 mt-3 relative z-10 rounded-full px-3 py-1.5 w-fit mx-auto" role="tablist" aria-label="التنقل بين العروض">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="rounded-full transition-all"
              role="tab"
              aria-selected={idx === i}
              aria-label={`عرض ${i + 1} من ${items.length}`}
              style={{
                width: idx === i ? 20 : 6,
                height: 6,
                background: idx === i ? "#c41040" : "#3f3f46",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
