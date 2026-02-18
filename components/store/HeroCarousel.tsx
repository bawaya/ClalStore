"use client";

import { useState, useEffect } from "react";
import { useScreen } from "@/lib/hooks";
import type { Hero } from "@/types/database";

// Fallback heroes when DB is empty
const FALLBACK_HEROES: Hero[] = [
  {
    id: "h1", title_ar: "عروض الصيف 🔥", title_he: "", subtitle_ar: "خصومات حتى 40% على أجهزة Samsung",
    subtitle_he: "", image_url: "", link_url: "", cta_text_ar: "تسوّق الآن", cta_text_he: "", sort_order: 1, active: true, created_at: "",
  },
  {
    id: "h2", title_ar: "iPhone 17 وصل!", title_he: "", subtitle_ar: "اطلب الآن واحصل على كفر MagSafe مجاناً",
    subtitle_he: "", image_url: "", link_url: "", cta_text_ar: "اطلب الآن", cta_text_he: "", sort_order: 2, active: true, created_at: "",
  },
];

export function HeroCarousel({ heroes }: { heroes?: Hero[] }) {
  const scr = useScreen();
  const items = heroes && heroes.length > 0 ? heroes : FALLBACK_HEROES;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items.length]);

  const h = items[idx];

  return (
    <div
      className="text-center relative"
      style={{
        background: "linear-gradient(135deg, rgba(196,16,64,0.12), rgba(168,85,247,0.08))",
        padding: scr.mobile ? "24px 20px" : "48px 40px",
        borderRadius: scr.mobile ? 0 : 20,
        margin: scr.mobile ? 0 : "0 0 20px",
      }}
    >
      {h.image_url && (
        <img
          src={h.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-[inherit]"
        />
      )}
      <div className="relative z-10">
        <h2
          className="font-black mb-1.5"
          style={{ fontSize: scr.mobile ? 20 : 32 }}
        >
          {h.title_ar}
        </h2>
        <p
          className="text-muted mb-3"
          style={{ fontSize: scr.mobile ? 11 : 16 }}
        >
          {h.subtitle_ar}
        </p>
        {h.cta_text_ar && (
          <button
            className="btn-primary"
            style={{
              padding: scr.mobile ? "10px 28px" : "12px 36px",
              fontSize: scr.mobile ? 12 : 14,
            }}
          >
            {h.cta_text_ar}
          </button>
        )}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 relative z-10">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="rounded-full transition-all"
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
