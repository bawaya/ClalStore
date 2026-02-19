"use client";

import { useState } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { calcDiscount } from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import type { Product, ProductColor } from "@/types/database";

export function ProductCard({ product: p }: { product: Product }) {
  const scr = useScreen();
  const { t } = useLang();
  const addItem = useCart((s) => s.addItem);
  const disc = p.old_price ? calcDiscount(p.price, p.old_price) : 0;
  const colors = (p.colors || []) as ProductColor[];
  const [selColor, setSelColor] = useState(0);

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
    });
  };

  return (
    <Link
      href={`/store/product/${p.id}`}
      className="card overflow-hidden cursor-pointer hover:border-surface-border/80 transition-all relative group"
    >
      {/* Badges */}
      {p.featured && (
        <span
          className="absolute top-2 right-2 z-10 badge"
          style={{ background: "rgba(196,16,64,0.15)", color: "#c41040" }}
        >
          🔥 {t("store.bestSeller").replace("🔥 ", "")}
        </span>
      )}
      {disc > 0 && (
        <span className="absolute top-2 left-2 z-10 bg-state-error text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
          -{disc}%
        </span>
      )}

      {/* Image — shows color-specific image if available */}
      <div
        className="bg-surface-elevated flex items-center justify-center overflow-hidden p-3"
        style={{ height: scr.mobile ? 200 : 230 }}
      >
        {(() => {
          const colorImg = colors[selColor]?.image;
          const imgSrc = colorImg || p.image_url;
          return imgSrc ? (
            <img
              src={imgSrc}
              alt={p.name_ar}
              className="w-full h-full object-contain"
            />
          ) : (
            <span
              className="opacity-15"
              style={{ fontSize: scr.mobile ? 48 : 56 }}
            >
              {p.type === "device" ? "📱" : "🔌"}
            </span>
          );
        })()}
      </div>

      {/* Info */}
      <div style={{ padding: scr.mobile ? "10px 10px 14px" : "14px 16px 18px" }}>
        <div
          className="flex items-center gap-1.5 mb-1"
        >
          {getBrandLogo(p.brand) && (
            <img
              src={getBrandLogo(p.brand)!}
              alt={p.brand}
              className="flex-shrink-0"
              style={{ width: scr.mobile ? 16 : 20, height: scr.mobile ? 16 : 20 }}
            />
          )}
          <span
            className="text-white font-extrabold uppercase tracking-wide"
            style={{ fontSize: scr.mobile ? 13 : 15 }}
          >
            {p.brand}
          </span>
        </div>
        <div
          className="font-extrabold mb-1.5 leading-tight"
          style={{ fontSize: scr.mobile ? 13 : 15 }}
          dir="ltr"
        >
          {p.name_ar}
        </div>

        {/* Colors — clickable */}
        {colors.length > 0 && (
          <div className="flex gap-1 mb-1.5 items-center">
            {colors.slice(0, 5).map((c, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelColor(i); }}
                title={c.name_ar}
                className="rounded-full cursor-pointer transition-all flex-shrink-0"
                style={{
                  width: scr.mobile ? 16 : 18,
                  height: scr.mobile ? 16 : 18,
                  background: c.hex,
                  border: selColor === i ? "2px solid #c41040" : "2px solid #333",
                  boxShadow: selColor === i ? "0 0 0 1px #c41040" : "none",
                }}
              />
            ))}
            {selColor < colors.length && (
              <span className="text-muted" style={{ fontSize: scr.mobile ? 8 : 9 }}>{colors[selColor].name_ar}</span>
            )}
          </div>
        )}

        {/* Price + Add to cart */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span
              className="font-black text-brand"
              style={{ fontSize: scr.mobile ? 16 : 20 }}
            >
              ₪{p.price.toLocaleString()}
            </span>
            {p.old_price && (
              <span
                className="text-dim line-through"
                style={{ fontSize: scr.mobile ? 10 : 12 }}
              >
                ₪{p.old_price.toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            className={`${scr.mobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all active:scale-95 text-white rounded-lg font-extrabold`}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              padding: scr.mobile ? '6px 10px' : '6px 12px',
              fontSize: scr.mobile ? 11 : 12,
              boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
            }}
          >
            {t("store.addToCart")}
          </button>
        </div>
      </div>
    </Link>
  );
}
