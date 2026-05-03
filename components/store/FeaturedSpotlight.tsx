"use client";

// =====================================================
// ClalMobile — FeaturedSpotlight
// Editorial 1 + 3 grid on /store. Position 1 = big "hero" card,
// positions 2..4 = smaller cards. Content (eyebrow + tagline) is
// managed from /admin/store-spotlights; product data is joined
// from the products list already fetched server-side.
// =====================================================

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { calcDiscount, getProductName } from "@/lib/utils";
import type { Product, StoreSpotlight } from "@/types/database";

export type SpotlightWithProduct = {
  spotlight: StoreSpotlight;
  product: Product;
};

export function FeaturedSpotlight({ items }: { items: SpotlightWithProduct[] }) {
  const { lang } = useLang();

  if (items.length === 0) return null;

  const isHe = lang === "he";

  // Sort by position so we can address slot 1 vs 2..4 deterministically
  const sorted = [...items].sort(
    (a, b) => a.spotlight.position - b.spotlight.position
  );
  const hero = sorted.find((i) => i.spotlight.position === 1);
  const small = sorted.filter((i) => i.spotlight.position !== 1);

  return (
    <section
      aria-label={isHe ? "פריטי ספוטלייט" : "منتجات Spotlight"}
      className="mb-6 space-y-3"
    >
      {hero && <SpotlightHeroCard item={hero} isHe={isHe} />}

      {small.length > 0 && (
        <div
          className={`grid gap-3 ${
            small.length === 1
              ? "grid-cols-1"
              : small.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {small.map((item) => (
            <SpotlightSmallCard key={item.spotlight.id} item={item} isHe={isHe} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Big "hero" card (position 1) — image + editorial copy side by side on desktop,
// stacked on mobile. Premium feel: subtle red glow, generous padding, oversized
// product image, italic tagline, eyebrow pill.
// ---------------------------------------------------------------------------
function SpotlightHeroCard({
  item,
  isHe,
}: {
  item: SpotlightWithProduct;
  isHe: boolean;
}) {
  const { spotlight, product } = item;
  const lang = isHe ? "he" : "ar";
  const productName = getProductName(product, lang);
  const eyebrow = isHe ? spotlight.eyebrow_he : spotlight.eyebrow_ar;
  const tagline = isHe ? spotlight.tagline_he || spotlight.tagline_ar : spotlight.tagline_ar;
  const imageSrc = spotlight.custom_image_url || product.image_url || "";
  const discount = product.old_price ? calcDiscount(product.price, product.old_price) : 0;
  const ctaLabel = isHe ? "קנה עכשיו" : "اشتري الآن";

  return (
    <Link
      href={`/store/product/${product.id}`}
      aria-label={productName}
      className="group relative block overflow-hidden rounded-[28px] border border-[#ff0e34]/25 bg-[linear-gradient(135deg,#0d0d0f_0%,#141417_100%)] transition-all hover:border-[#ff0e34]/55"
      style={{ boxShadow: "0 24px 60px rgba(255,14,52,0.10), inset 0 0 80px rgba(255,14,52,0.04)" }}
    >
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-0">
        {/* Image side — large, vertical aspect on desktop */}
        <div className="relative min-h-[280px] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,14,52,0.10),transparent_70%)] lg:min-h-[460px]">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={productName}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-contain p-8 transition-transform duration-500 group-hover:scale-[1.03] lg:p-12"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/15 text-7xl">📦</div>
          )}

          {discount > 0 && (
            <span className="absolute right-5 top-5 rounded-full bg-[#ff0e34] px-3 py-1 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(255,14,52,0.40)]">
              -{discount}%
            </span>
          )}
        </div>

        {/* Text side — editorial */}
        <div className="flex flex-col justify-center gap-4 p-7 lg:p-12">
          {eyebrow && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#ff0e34]/35 bg-[#ff0e34]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff8da0]">
              {eyebrow}
            </span>
          )}

          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              {product.brand}
            </div>
            <h2
              className="mt-1.5 text-[28px] font-black leading-tight text-white lg:text-[40px]"
              dir="auto"
            >
              {productName}
            </h2>
          </div>

          {tagline && (
            <p
              className="text-[15px] italic leading-relaxed text-white/75 lg:text-[17px]"
              dir="auto"
            >
              &ldquo;{tagline}&rdquo;
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <strong className="text-[28px] font-black leading-none text-white lg:text-[36px]">
              ₪{product.price.toLocaleString()}
            </strong>
            {product.old_price && product.old_price > product.price && (
              <span className="text-[14px] text-white/35 line-through">
                ₪{product.old_price.toLocaleString()}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ff0e34] px-6 py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(255,14,52,0.35)] transition-transform group-hover:scale-[1.03]">
              {ctaLabel}
              <ChevronLeft size={16} strokeWidth={2.2} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Small card (positions 2-4) — vertical stack: image on top, name + tagline +
// price + CTA below. Less ceremony than the hero card but still editorial.
// ---------------------------------------------------------------------------
function SpotlightSmallCard({
  item,
  isHe,
}: {
  item: SpotlightWithProduct;
  isHe: boolean;
}) {
  const { spotlight, product } = item;
  const lang = isHe ? "he" : "ar";
  const productName = getProductName(product, lang);
  const eyebrow = isHe ? spotlight.eyebrow_he : spotlight.eyebrow_ar;
  const tagline = isHe ? spotlight.tagline_he || spotlight.tagline_ar : spotlight.tagline_ar;
  const imageSrc = spotlight.custom_image_url || product.image_url || "";
  const discount = product.old_price ? calcDiscount(product.price, product.old_price) : 0;
  const ctaLabel = isHe ? "קנה" : "اشتري";

  return (
    <Link
      href={`/store/product/${product.id}`}
      aria-label={productName}
      className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,#0d0d0f_0%,#0a0a0c_100%)] transition-all hover:border-[#ff0e34]/45"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_center,rgba(255,14,52,0.06),transparent_70%)]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={productName}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/15 text-5xl">📦</div>
        )}

        {discount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-[#ff0e34] px-2 py-0.5 text-[10px] font-bold text-white">
            -{discount}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {eyebrow && (
          <span className="inline-flex w-fit rounded-full border border-[#ff0e34]/30 bg-[#ff0e34]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#ff8da0]">
            {eyebrow}
          </span>
        )}

        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            {product.brand}
          </div>
          <h3
            className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-tight text-white"
            dir="auto"
          >
            {productName}
          </h3>
        </div>

        {tagline && (
          <p
            className="line-clamp-2 text-[12px] italic leading-snug text-white/65"
            dir="auto"
          >
            &ldquo;{tagline}&rdquo;
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            <strong className="text-[18px] font-black leading-none text-white">
              ₪{product.price.toLocaleString()}
            </strong>
            {product.old_price && product.old_price > product.price && (
              <span className="mt-1 text-[10px] text-white/30 line-through">
                ₪{product.old_price.toLocaleString()}
              </span>
            )}
          </div>

          <span className="rounded-full bg-[#ff0e34] px-3.5 py-1.5 text-[11px] font-bold text-white transition-opacity group-hover:opacity-90">
            {ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
