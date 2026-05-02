"use client";

import Link from "next/link";
import { ShoppingCart, ChevronLeft } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export function StickyCartBar({ variant = "bottom" }: { variant?: "bottom" | "top" } = {}) {
  const scr = useScreen();
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());
  const total = useCart((s) => s.getTotal());

  if (itemCount === 0) return null;

  const isTop = variant === "top";

  return (
    <div
      className={`sticky-cart-bar ${isTop ? "fixed top-[60px] left-0 right-0 z-[49] border-b" : "border-t"} border-[#2f2f38]`}
      style={{
        background: "linear-gradient(180deg, rgba(23,23,27,0.96), rgba(17,17,21,0.98))",
        boxShadow: isTop ? "0 18px 36px rgba(0,0,0,0.28)" : "0 -18px 36px rgba(0,0,0,0.28)",
      }}
    >
      <div
        className="mx-auto flex max-w-[1200px] items-center justify-between"
        style={{ padding: scr.mobile ? "8px 14px" : "10px 28px" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart size={scr.mobile ? 18 : 20} className="text-[#ff667d]" />
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
              className="font-bold text-white"
              style={{ fontSize: scr.mobile ? 12 : 14, lineHeight: 1.2 }}
            >
              {t("store.cart")}
              <span
                className="ms-1.5 font-normal text-[#b8b8c2]"
                style={{ fontSize: scr.mobile ? 10 : 12 }}
              >
                ({itemCount} {itemCount === 1 ? t("cartBar.item") : t("cartBar.items")})
              </span>
            </span>
            <span
              className="font-black text-[#ff667d]"
              style={{ fontSize: scr.mobile ? 14 : 16, lineHeight: 1.2 }}
            >
              ₪{total.toLocaleString()}
            </span>
          </div>
        </div>

        <Link
          href="/store/cart"
          className="flex items-center gap-1.5 rounded-xl font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{
            padding: scr.mobile ? "8px 16px" : "10px 24px",
            fontSize: scr.mobile ? 12 : 14,
            background: "linear-gradient(135deg, #ff0e34, #ff3351)",
            boxShadow: "0 4px 15px rgba(196,16,64,0.3)",
          }}
        >
          {t("store.checkout")}
          <ChevronLeft size={16} />
        </Link>
      </div>

      <div
        className="absolute bottom-0 left-[15%] right-[15%] h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,51,81,0.25), transparent)",
        }}
      />
    </div>
  );
}
