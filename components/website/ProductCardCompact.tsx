"use client";

// Compact product card — used on the homepage FeaturedProducts grid only.
// Differences from the full ProductCard (components/store/ProductCard.tsx):
//   - No inline color/storage selection (informational color count only)
//   - No inline "add to cart", no Compare/Wishlist buttons
//   - No description, stock label, monthly installment line, or warranty badge
//   - Whole card is a Link to /store/product/[id] which renders the FULL
//     ProductDetail (unchanged) — that's where users select & purchase.
// Goal: lighter, premium-feeling teaser tile for the landing page.

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Smartphone, Home, Plug } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { calcDiscount, getProductName } from "@/lib/utils";
import type { Product } from "@/types/database";

export const ProductCardCompact = memo(function ProductCardCompact({
  product,
}: {
  product: Product;
}) {
  const { lang } = useLang();
  const productName = getProductName(product, lang);
  const colorsCount = (product.colors || []).length;
  const discount = product.old_price ? calcDiscount(product.price, product.old_price) : 0;

  const colorsLabel =
    colorsCount > 0
      ? lang === "he"
        ? `${colorsCount} ${colorsCount === 1 ? "צבע" : "צבעים"}`
        : `${colorsCount} ${colorsCount === 1 ? "لون" : "ألوان"}`
      : null;

  const FallbackIcon =
    product.type === "device" ? Smartphone : product.type === "appliance" ? Home : Plug;

  return (
    <Link
      href={`/store/product/${product.id}`}
      aria-label={productName}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0d0d0f] transition-colors hover:border-[#ff0e34]"
    >
      {/* Discount badge */}
      {discount > 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-[#ff0e34] px-2 py-0.5 text-[10px] font-bold text-white">
          -{discount}%
        </span>
      )}

      {/* Image — square aspect for consistent grid */}
      <div className="relative aspect-square bg-white/[0.02]">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={productName}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-5"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-white/20">
            <FallbackIcon size={48} strokeWidth={1.4} />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
          {product.brand}
        </div>

        <h3
          className="line-clamp-2 min-h-[2.6em] text-[14px] font-medium leading-tight text-white"
          dir="auto"
        >
          {productName}
        </h3>

        {colorsLabel && (
          <div className="text-[10px] text-white/40">{colorsLabel}</div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            <strong className="text-[16px] font-bold leading-none text-white">
              ₪{product.price.toLocaleString()}
            </strong>
            {product.old_price && product.old_price > product.price && (
              <span className="mt-1 text-[11px] text-white/30 line-through">
                ₪{product.old_price.toLocaleString()}
              </span>
            )}
          </div>

          <span className="rounded-full bg-[#ff0e34] px-3 py-1.5 text-[11px] font-medium text-white transition group-hover:opacity-90">
            {lang === "he" ? "צפייה" : "اشتري"}
          </span>
        </div>
      </div>
    </Link>
  );
});
