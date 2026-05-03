"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShoppingCart, ChevronLeft } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

// PADDING COORDINATION (paired with TopPromoBar):
// - When this bar is active (cart has items), WE write body.paddingTop = cartH + promoH
// - We read --top-promo-h from CSS to compute promoH
// - We listen to "top-promo-changed" so that resizing/mount of TopPromoBar triggers recompute
// - We fire "cart-bar-changed" on activation/deactivation so TopPromoBar can take over padding

export function StickyCartBar({ variant = "top" }: { variant?: "bottom" | "top" } = {}) {
  const scr = useScreen();
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());
  const total = useCart((s) => s.getTotal());
  const ref = useRef<HTMLDivElement>(null);
  const isTop = variant === "top";
  const active = isTop && itemCount > 0;

  useEffect(() => {
    if (!active) return;

    const update = () => {
      const cartH = ref.current?.offsetHeight ?? (scr.mobile ? 50 : 56);
      const promoH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--top-promo-h") || "0",
          10
        ) || 0;
      document.documentElement.style.setProperty("--cart-bar-h", `${cartH}px`);
      document.body.style.paddingTop = `${cartH + promoH}px`;
      window.dispatchEvent(new CustomEvent("cart-bar-changed"));
    };

    update();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && ref.current) {
      observer = new ResizeObserver(update);
      observer.observe(ref.current);
    }

    const onPromoChanged = () => update();
    window.addEventListener("top-promo-changed", onPromoChanged);

    return () => {
      observer?.disconnect();
      window.removeEventListener("top-promo-changed", onPromoChanged);
      document.documentElement.style.removeProperty("--cart-bar-h");
      document.body.style.paddingTop = "";
      // Notify TopPromoBar that cart bar is gone — it may need to take over padding
      window.dispatchEvent(new CustomEvent("cart-bar-changed"));
    };
  }, [active, scr.mobile]);

  if (itemCount === 0) return null;

  return (
    <div
      ref={ref}
      className={`sticky-cart-bar ${
        isTop
          ? "fixed top-0 left-0 right-0 z-[60] border-t-[3px] border-b border-[#ff0e34]"
          : "border-t border-[#2f2f38]"
      }`}
      style={{
        background: isTop
          ? "#0d0d0f"
          : "linear-gradient(180deg, rgba(23,23,27,0.96), rgba(17,17,21,0.98))",
        boxShadow: isTop
          ? "inset 0 0 24px rgba(255, 14, 52, 0.08), 0 18px 36px rgba(0,0,0,0.28)"
          : "0 -18px 36px rgba(0,0,0,0.28)",
        // Override only the bottom border opacity for top variant via inline style
        // (Tailwind border classes apply same color to all sides)
        ...(isTop ? { borderBottomColor: "rgba(255, 14, 52, 0.4)" } : {}),
      }}
    >
      <div
        className="mx-auto flex max-w-[1200px] items-center justify-between"
        style={{ padding: scr.mobile ? "8px 14px" : "10px 28px" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart
              size={scr.mobile ? 18 : 20}
              className={isTop ? "text-[#ff0e34]" : "text-[#ff667d]"}
              strokeWidth={1.6}
            />
            <span
              className="absolute -top-2 flex items-center justify-center rounded-full font-black"
              style={{
                insetInlineEnd: -8,
                width: 18,
                height: 18,
                fontSize: 10,
                background: "linear-gradient(135deg, #ff0e34, #ff3351)",
                color: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }}
            >
              {itemCount}
            </span>
          </div>

          <div className="flex flex-col">
            <span
              className={isTop ? "font-bold text-white/65" : "font-bold text-white"}
              style={{ fontSize: scr.mobile ? 12 : 14, lineHeight: 1.2 }}
            >
              {t("store.cart")}
              <span
                className={isTop ? "ms-1.5 font-normal text-white/65" : "ms-1.5 font-normal text-[#b8b8c2]"}
                style={{ fontSize: scr.mobile ? 10 : 12 }}
              >
                ({itemCount} {itemCount === 1 ? t("cartBar.item") : t("cartBar.items")})
              </span>
            </span>
            <span
              className={isTop ? "font-black text-white/65" : "font-black text-[#ff667d]"}
              style={{ fontSize: scr.mobile ? 14 : 16, lineHeight: 1.2 }}
            >
              ₪{total.toLocaleString()}
            </span>
          </div>
        </div>

        <Link
          href="/store/cart"
          className={`flex items-center gap-1.5 font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.97] ${
            isTop ? "rounded-full" : "rounded-xl"
          }`}
          style={{
            padding: scr.mobile ? "8px 16px" : "10px 24px",
            fontSize: scr.mobile ? 12 : 14,
            background: isTop ? "#ff0e34" : "linear-gradient(135deg, #ff0e34, #ff3351)",
            boxShadow: "0 4px 15px rgba(196,16,64,0.3)",
          }}
        >
          {t("store.checkout")}
          <ChevronLeft size={16} />
        </Link>
      </div>

      {!isTop && (
        <div
          className="absolute bottom-0 left-[15%] right-[15%] h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,51,81,0.25), transparent)",
          }}
        />
      )}
    </div>
  );
}
