"use client";

import { useState } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { calcDiscount } from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import type { Product, ProductColor } from "@/types/database";

/* ── warranty ribbon helpers ── */
function getWarrantyKey(p: Product): string | null {
  const w = p.specs?.warranty;
  if (w) {
    if (/3/.test(w)) return "store.warranty3";
    if (/2|שנתיים|سنتين/.test(w)) return "store.warranty2";
    return "store.warrantyYear";
  }
  if (p.type === "device") return "store.warranty2";
  return null;
}

export function ProductCard({ product: p }: { product: Product }) {
  const scr = useScreen();
  const { t } = useLang();
  const addItem = useCart((s) => s.addItem);
  const disc = p.old_price ? calcDiscount(p.price, p.old_price) : 0;
  const colors = (p.colors || []) as ProductColor[];
  const storage = p.storage_options || [];
  const [selColor, setSelColor] = useState(0);
  const [selStorage, setSelStorage] = useState(0);

  const warrantyKey = getWarrantyKey(p);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: p.id,
      name: p.name_ar,
      brand: p.brand,
      type: p.type as "device" | "accessory",
      price: p.price,
      image: p.image_url || undefined,
      color: colors[selColor]?.name_ar,
      storage: storage[selStorage],
    });
  };

  return (
    <Link
      href={`/store/product/${p.id}`}
      className="card overflow-hidden cursor-pointer hover:border-[#c41040]/40 transition-all relative group flex flex-col"
    >
      {/* ── Warranty / Promo Ribbon (top-right) ── */}
      {warrantyKey && (
        <div
          className="absolute top-0 z-10 font-extrabold text-white text-center leading-tight"
          style={{
            right: 0,
            background: "#c41040",
            fontSize: scr.mobile ? 8 : 10,
            padding: scr.mobile ? "3px 8px" : "4px 12px",
            borderRadius: "0 0 0 8px",
          }}
        >
          {t(warrantyKey)}
        </div>
      )}

      {/* ── Discount badge (top-left) ── */}
      {disc > 0 && (
        <span
          className="absolute top-2 left-2 z-10 text-white font-extrabold rounded-md"
          style={{
            background: "#c41040",
            fontSize: scr.mobile ? 9 : 11,
            padding: scr.mobile ? "2px 5px" : "3px 8px",
          }}
        >
          -{disc}%
        </span>
      )}

      {/* ── Product Image ── */}
      <div
        className="bg-[#1a1a1e] flex items-center justify-center overflow-hidden relative"
        style={{ height: scr.mobile ? 180 : 230, padding: scr.mobile ? 8 : 16 }}
      >
        {(() => {
          const colorImg = colors[selColor]?.image;
          const imgSrc = colorImg || p.image_url;
          return imgSrc ? (
            <img
              src={imgSrc}
              alt={p.name_ar}
              className="max-h-full max-w-full object-contain drop-shadow-lg"
            />
          ) : (
            <span
              className="opacity-15"
              style={{ fontSize: scr.mobile ? 48 : 64 }}
            >
              {p.type === "device" ? "📱" : "🔌"}
            </span>
          );
        })()}

        {/* Free shipping badge */}
        {p.featured && (
          <div
            className="absolute font-bold text-white rounded-full flex items-center justify-center text-center leading-tight"
            style={{
              bottom: scr.mobile ? 4 : 8,
              left: scr.mobile ? 4 : 8,
              width: scr.mobile ? 44 : 56,
              height: scr.mobile ? 44 : 56,
              background: "linear-gradient(135deg, #c41040 0%, #e91e63 100%)",
              fontSize: scr.mobile ? 7 : 8,
              boxShadow: "0 2px 8px rgba(196,16,64,0.5)",
            }}
          >
            {t("store.freeShipping").split("\n").map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Info Section ── */}
      <div
        className="flex-1 flex flex-col"
        style={{ padding: scr.mobile ? "10px 10px 12px" : "14px 16px 16px" }}
      >
        {/* Brand + Name */}
        <div className="flex items-center gap-1.5 mb-0.5">
          {getBrandLogo(p.brand) && (
            <img
              src={getBrandLogo(p.brand)!}
              alt={p.brand}
              className="flex-shrink-0"
              style={{ width: scr.mobile ? 14 : 18, height: scr.mobile ? 14 : 18 }}
            />
          )}
          <span
            className="text-[#a1a1aa] font-bold uppercase tracking-wide"
            style={{ fontSize: scr.mobile ? 10 : 12 }}
          >
            {p.brand}
          </span>
        </div>
        <div
          className="font-extrabold text-white mb-1 leading-tight"
          style={{ fontSize: scr.mobile ? 13 : 16 }}
          dir="ltr"
        >
          {p.name_ar}
        </div>

        {/* Description (subtitle) */}
        {p.description_ar && (
          <div
            className="text-[#71717a] leading-snug mb-1.5"
            style={{ fontSize: scr.mobile ? 9 : 11 }}
          >
            {p.description_ar.length > 60
              ? p.description_ar.slice(0, 60) + "..."
              : p.description_ar}
          </div>
        )}

        {/* ── Price ── */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span
            className="font-black"
            style={{
              color: "#c41040",
              fontSize: scr.mobile ? 18 : 22,
            }}
          >
            ₪{p.price.toLocaleString()}
          </span>
          {p.old_price && (
            <span
              className="line-through text-[#52525b]"
              style={{ fontSize: scr.mobile ? 10 : 13 }}
            >
              ₪{p.old_price.toLocaleString()}
            </span>
          )}
        </div>

        {/* ── Storage options (selectable pills) ── */}
        {storage.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {storage.map((s, i) => (
              <button
                key={s}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelStorage(i);
                }}
                className="cursor-pointer transition-all font-bold"
                style={{
                  fontSize: scr.mobile ? 9 : 11,
                  padding: scr.mobile ? "3px 8px" : "4px 12px",
                  borderRadius: 6,
                  border:
                    selStorage === i
                      ? "1.5px solid #c41040"
                      : "1.5px solid #3f3f46",
                  background:
                    selStorage === i
                      ? "rgba(196,16,64,0.12)"
                      : "transparent",
                  color: selStorage === i ? "#c41040" : "#a1a1aa",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Color swatches ── */}
        {colors.length > 0 && (
          <div className="flex gap-1.5 items-center mb-2">
            {colors.slice(0, 6).map((c, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelColor(i);
                }}
                title={c.name_ar}
                className="rounded-full cursor-pointer transition-all flex-shrink-0"
                style={{
                  width: scr.mobile ? 18 : 22,
                  height: scr.mobile ? 18 : 22,
                  background: c.hex,
                  border:
                    selColor === i
                      ? "2.5px solid #c41040"
                      : "2px solid #3f3f46",
                  boxShadow:
                    selColor === i
                      ? "0 0 0 1.5px rgba(196,16,64,0.5)"
                      : "none",
                }}
              />
            ))}
          </div>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Add to Cart button ── */}
        <button
          onClick={handleAddToCart}
          className="w-full cursor-pointer transition-all active:scale-[0.97] font-extrabold rounded-lg"
          style={{
            border: "1.5px solid #c41040",
            background: "transparent",
            color: "#c41040",
            padding: scr.mobile ? "7px 0" : "9px 0",
            fontSize: scr.mobile ? 12 : 14,
            marginTop: scr.mobile ? 4 : 6,
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "rgba(196,16,64,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {t("store.addToCart")}
        </button>
      </div>
    </Link>
  );
}
