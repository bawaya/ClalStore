"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import type { Hero } from "@/types/database";

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
    const timer = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
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
      delta > 0
        ? setIdx((i) => (i + 1) % items.length)
        : setIdx((i) => (i - 1 + items.length) % items.length);
    }
  };

  const goNext = () => setIdx((i) => (i + 1) % items.length);
  const goPrev = () => setIdx((i) => (i - 1 + items.length) % items.length);

  const h = items[idx];
  const title = lang === "he" ? (h.title_he || h.title_ar) : h.title_ar;
  const subtitle = lang === "he" ? (h.subtitle_he || h.subtitle_ar) : h.subtitle_ar;
  const ctaText = lang === "he" ? (h.cta_text_he || h.cta_text_ar) : h.cta_text_ar;

  return (
    <div
      className="hero-carousel relative overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="عروض مميزة"
      style={{
        minHeight: scr.mobile ? 220 : 380,
        maxWidth: 1200,
        margin: scr.mobile ? 0 : "0 auto 20px",
        borderRadius: scr.mobile ? 0 : 20,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background image — full bleed, no glass overlay */}
      {h.image_url && (
        <Image
          src={h.image_url}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ borderRadius: "inherit" }}
          priority={idx === 0}
        />
      )}

      {/* Subtle gradient vignette so text remains readable over any image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          background: h.image_url
            ? "linear-gradient(to top, rgba(9,9,11,0.7) 0%, rgba(9,9,11,0.2) 40%, transparent 70%)"
            : "transparent",
        }}
      />

      {/* Content — centered, clear, no glass panel */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center h-full"
        style={{
          minHeight: scr.mobile ? 220 : 380,
          padding: scr.mobile ? "32px 20px" : "48px 40px",
        }}
        aria-live="polite"
      >
        <h2
          className="font-black mb-2 hero-text-shadow"
          style={{ fontSize: scr.mobile ? 22 : 36, lineHeight: 1.2 }}
        >
          {title}
        </h2>
        <p
          className="mb-4 hero-text-shadow"
          style={{
            fontSize: scr.mobile ? 12 : 17,
            color: "rgba(255,255,255,0.85)",
            maxWidth: 520,
          }}
        >
          {subtitle}
        </p>
        {ctaText && (
          h.link_url ? (
            <Link
              href={h.link_url}
              className="btn-primary inline-block"
              style={{
                padding: scr.mobile ? "10px 32px" : "12px 40px",
                fontSize: scr.mobile ? 13 : 15,
              }}
            >
              {ctaText}
            </Link>
          ) : (
            <button
              className="btn-primary opacity-50 cursor-not-allowed"
              disabled
              style={{
                padding: scr.mobile ? "10px 32px" : "12px 40px",
                fontSize: scr.mobile ? 13 : 15,
              }}
            >
              {ctaText}
            </button>
          )
        )}
      </div>

      {/* Desktop nav arrows */}
      {items.length > 1 && scr.desktop && (
        <>
          <button
            onClick={goPrev}
            className="hero-nav-arrow"
            style={{ left: 16 }}
            aria-label="العرض السابق"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            className="hero-nav-arrow"
            style={{ right: 16 }}
            aria-label="العرض التالي"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dots indicator — clean, no glass container */}
      {items.length > 1 && (
        <div
          className="absolute z-10 flex justify-center gap-2"
          style={{ bottom: scr.mobile ? 12 : 20, left: 0, right: 0 }}
          role="tablist"
          aria-label="التنقل بين العروض"
        >
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="rounded-full transition-all"
              role="tab"
              aria-selected={idx === i}
              aria-label={`عرض ${i + 1} من ${items.length}`}
              style={{
                width: idx === i ? 24 : 8,
                height: 8,
                background: idx === i
                  ? "linear-gradient(135deg, #c41040, #ff3366)"
                  : "rgba(255,255,255,0.3)",
                boxShadow: idx === i ? "0 0 8px rgba(196,16,64,0.5)" : "none",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
