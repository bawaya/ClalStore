"use client";

import { useEffect, useRef } from "react";

// PADDING COORDINATION:
// - When StickyCartBar is active (itemCount > 0): IT writes body.paddingTop = cartH + promoH
// - When StickyCartBar is inactive: WE write body.paddingTop = promoH
// - Both clear paddingTop on cleanup ONLY if the other isn't writing it
// - Both fire CustomEvents (top-promo-changed / cart-bar-changed) so the other recomputes

export default function TopPromoBar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const promoH = ref.current?.offsetHeight ?? 32;
      document.documentElement.style.setProperty("--top-promo-h", `${promoH}px`);

      const cartH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--cart-bar-h") || "0",
          10
        ) || 0;

      // Only write padding if StickyCartBar isn't active (cartH === 0)
      if (cartH === 0) {
        document.body.style.paddingTop = `${promoH}px`;
      }
      // If cartH > 0, StickyCartBar is responsible for the combined paddingTop

      // Notify StickyCartBar (and any other listeners) that promo height may have changed
      window.dispatchEvent(new CustomEvent("top-promo-changed"));
    };

    update();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && ref.current) {
      observer = new ResizeObserver(update);
      observer.observe(ref.current);
    }

    // When cart bar appears/disappears, we may need to take over (or yield) padding
    const onCartChanged = () => update();
    window.addEventListener("cart-bar-changed", onCartChanged);

    return () => {
      observer?.disconnect();
      window.removeEventListener("cart-bar-changed", onCartChanged);
      document.documentElement.style.removeProperty("--top-promo-h");

      // Only clear paddingTop if StickyCartBar isn't currently using it
      const cartH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--cart-bar-h") || "0",
          10
        ) || 0;
      if (cartH === 0) {
        document.body.style.paddingTop = "";
      }

      // Notify StickyCartBar that promo is gone, so it can recompute
      window.dispatchEvent(new CustomEvent("top-promo-changed"));
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-label="عرض ترويجي"
      className="fixed left-0 right-0 z-[55] bg-[#0d0d0f] py-2 px-4 text-center text-[11px] text-white/85 border-b border-[#ff0e34]"
      style={{ top: "var(--cart-bar-h, 0px)" }}
      dir="rtl"
    >
      تقسيط <strong className="text-[#ff0e34] font-medium">18× بسعر الكاش</strong>، بدون فوائد، بدون حجز بطاقتك
    </div>
  );
}
