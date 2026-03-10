"use client";

import Link from "next/link";
import { ShoppingCart, ChevronLeft } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export function StickyCartBar() {
  const scr = useScreen();
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());
  const total = useCart((s) => s.getTotal());

  if (itemCount === 0) return null;

  return (
    <div className="sticky-cart-bar">
      <div
        className="max-w-[1200px] mx-auto flex items-center justify-between"
        style={{ padding: scr.mobile ? "8px 14px" : "10px 28px" }}
      >
        {/* Cart info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart
              size={scr.mobile ? 18 : 20}
              className="text-brand-light"
            />
            <span
              className="absolute -top-2 rounded-full font-black flex items-center justify-center"
              style={{
                insetInlineEnd: -8,
                width: 18,
                height: 18,
                fontSize: 10,
                background: "linear-gradient(135deg, #c41040, #ff3366)",
                color: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }}
            >
              {itemCount}
            </span>
          </div>

          <div className="flex flex-col">
            <span
              className="font-bold text-white"
              style={{ fontSize: scr.mobile ? 12 : 14, lineHeight: 1.2 }}
            >
              {t("store.cart")}
              <span className="text-muted font-normal ms-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                ({itemCount} {itemCount === 1 ? t("cartBar.item") : t("cartBar.items")})
              </span>
            </span>
            <span
              className="font-black text-brand-light"
              style={{ fontSize: scr.mobile ? 14 : 16, lineHeight: 1.2 }}
            >
              ₪{total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* CTA button */}
        <Link
          href="/store/cart"
          className="flex items-center gap-1.5 rounded-xl font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{
            padding: scr.mobile ? "8px 16px" : "10px 24px",
            fontSize: scr.mobile ? 12 : 14,
            background: "linear-gradient(135deg, #c41040, #ff3366)",
            boxShadow: "0 4px 15px rgba(196,16,64,0.3)",
          }}
        >
          {t("store.checkout")}
          <ChevronLeft size={16} />
        </Link>
      </div>

      {/* Brand glow line */}
      <div
        className="absolute bottom-0 left-[15%] right-[15%] h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(196,16,64,0.2), transparent)",
        }}
      />
    </div>
  );
}
