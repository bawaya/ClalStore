"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  Home,
  Plug,
  Scale,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { useCompare } from "@/lib/store/compare";
import { useWishlist } from "@/lib/store/wishlist";
import {
  calcDiscount,
  getColorName,
  getDescription,
  getProductName,
} from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import { INSTALLMENTS_BY_TYPE } from "@/lib/constants";
import type { Product, ProductColor, ProductVariant } from "@/types/database";

function getActiveVariant(
  product: Product,
  storageIdx: number
): ProductVariant | null {
  const variants = product.variants || [];
  if (variants.length === 0) return null;
  const storage = product.storage_options || [];
  const selectedLabel = storage[storageIdx];
  return variants.find((variant) => variant.storage === selectedLabel) || variants[0] || null;
}

function getDisplayPrice(
  product: Product,
  variant: ProductVariant | null
): { price: number; old_price?: number } {
  if (variant) return { price: variant.price, old_price: variant.old_price };
  return { price: product.price, old_price: product.old_price };
}

function getWarrantyKey(product: Product): string | null {
  const warranty = product.specs?.warranty;
  if (warranty) {
    if (/3/.test(warranty)) return "store.warranty3";
    if (/2|שנתיים|سنتين/.test(warranty)) return "store.warranty2";
    return "store.warrantyYear";
  }
  if (product.type === "device") return "store.warranty2";
  if (
    product.type === "appliance" &&
    product.warranty_months &&
    product.warranty_months >= 24
  ) {
    return "store.warranty2";
  }
  if (
    product.type === "appliance" &&
    product.warranty_months &&
    product.warranty_months >= 12
  ) {
    return "store.warrantyYear";
  }
  return null;
}

export const ProductCard = memo(function ProductCard({
  product,
}: {
  product: Product;
}) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const addItem = useCart((s) => s.addItem);
  const addToCompare = useCompare((s) => s.addItem);
  const removeFromCompare = useCompare((s) => s.removeItem);
  const inCompare = useCompare((s) => s.items.some((item) => item.id === product.id));
  const addToWishlist = useWishlist((s) => s.addItem);
  const removeFromWishlist = useWishlist((s) => s.removeItem);
  const inWishlist = useWishlist((s) => s.items.some((item) => item.id === product.id));
  const colors = (product.colors || []) as ProductColor[];
  const storage = product.storage_options || [];
  const [selColor, setSelColor] = useState(colors.length === 1 ? 0 : -1);
  const [selStorage, setSelStorage] = useState(storage.length <= 1 ? 0 : -1);
  const [wishAnim, setWishAnim] = useState(false);
  const [compareToast, setCompareToast] = useState("");

  const activeVariant = getActiveVariant(product, selStorage < 0 ? 0 : selStorage);
  const { price: displayPrice, old_price: displayOldPrice } = getDisplayPrice(
    product,
    activeVariant
  );
  const discount = displayOldPrice
    ? calcDiscount(displayPrice, displayOldPrice)
    : 0;
  const warrantyKey = getWarrantyKey(product);
  const needsColor = colors.length > 0 && selColor < 0;
  const needsStorage = storage.length > 1 && selStorage < 0;
  const selectionIncomplete = needsColor || needsStorage;
  const productName = getProductName(product, lang);
  const description = getDescription(product, lang);
  const activeColor = selColor >= 0 ? colors[selColor] : undefined;
  const imageSrc = activeColor?.image || product.image_url || undefined;
  const brandLogo = getBrandLogo(product.brand);
  const stockVal = activeVariant?.stock ?? product.stock;
  const months = INSTALLMENTS_BY_TYPE[product.type] || 0;
  const monthly = activeVariant?.monthly_price;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectionIncomplete) return;
    addItem({
      productId: product.id,
      name: product.name_ar,
      name_he: product.name_he || undefined,
      brand: product.brand,
      type: product.type,
      price: displayPrice,
      image: activeColor?.image || product.image_url || undefined,
      color: activeColor?.name_ar,
      color_he: activeColor?.name_he || undefined,
      storage: storage[selStorage],
    });
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(product.id);
      return;
    }
    const ok = addToCompare(product);
    if (!ok) {
      setCompareToast(t("compare.maxReached"));
      setTimeout(() => setCompareToast(""), 2000);
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishAnim(true);
    setTimeout(() => setWishAnim(false), 300);
    if (inWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const stockLabel =
    stockVal === 0
      ? {
          text: t("store.outOfStock"),
          className: "text-[#ff8b8b]",
          icon: <AlertTriangle size={13} />,
        }
      : stockVal <= 5
        ? {
            text:
              lang === "he"
                ? `נשארו ${stockVal} יחידות בלבד`
                : `باقي ${stockVal} قطع فقط`,
            className: "text-[#ffcc77]",
            icon: <AlertTriangle size={13} />,
          }
        : {
            text: t("store.inStock"),
            className: "text-[#8fe0a8]",
            icon: <CheckCircle2 size={13} />,
          };

  return (
    <Link
      href={`/store/product/${product.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[#383842] bg-[linear-gradient(180deg,#242429_0%,#1e1e24_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,51,81,0.12),transparent_72%)] opacity-70" />

      <div className="absolute left-4 top-4 z-10 flex flex-col items-start gap-2">
        {discount > 0 && (
          <span className="rounded-full bg-[#ff0e34] px-2.5 py-1 text-[11px] font-black text-white">
            -{discount}%
          </span>
        )}
        {warrantyKey && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-2.5 py-1 text-[11px] font-bold text-[#ffd8de]">
            <ShieldCheck size={12} />
            {t(warrantyKey)}
          </span>
        )}
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          onClick={handleCompare}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            inCompare
              ? "border-[#ff3351]/45 bg-[#ff3351]/10 text-white"
              : "border-[#3a3a44] bg-black/10 text-[#d7d7de] hover:border-[#ff3351]/35 hover:text-white"
          }`}
          title={inCompare ? t("compare.inCompare") : t("compare.add")}
          aria-label={inCompare ? t("compare.inCompare") : t("compare.add")}
        >
          <Scale size={16} />
        </button>

        <button
          onClick={handleWishlist}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
            inWishlist
              ? "border-[#ff3351]/45 bg-[#ff3351]/10 text-[#ff92a3]"
              : "border-[#3a3a44] bg-black/10 text-[#d7d7de] hover:border-[#ff3351]/35 hover:text-white"
          }`}
          style={{ transform: wishAnim ? "scale(1.12)" : "scale(1)" }}
          title={inWishlist ? t("wishlist.remove") : t("wishlist.add")}
          aria-label={inWishlist ? t("wishlist.remove") : t("wishlist.add")}
        >
          <Heart size={16} {...(inWishlist ? { fill: "currentColor" } : {})} />
        </button>
      </div>

      {compareToast && (
        <div className="absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-[#363640] bg-[#121216] px-4 py-2 text-xs font-bold text-white shadow-lg">
          {compareToast}
        </div>
      )}

      <div
        className="relative flex items-center justify-center overflow-hidden px-4 pt-14"
        style={{ minHeight: scr.mobile ? 210 : 250 }}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={productName}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-contain p-6 drop-shadow-[0_18px_22px_rgba(0,0,0,0.26)]"
            loading="lazy"
          />
        ) : (
          <span className="flex items-center justify-center text-white/20">
            {product.type === "device" ? (
              <Smartphone size={scr.mobile ? 48 : 64} />
            ) : product.type === "appliance" ? (
              <Home size={scr.mobile ? 48 : 64} />
            ) : (
              <Plug size={scr.mobile ? 48 : 64} />
            )}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-[1.15rem] pb-[1.2rem] pt-1">
        <div className="mb-3 flex items-center gap-2 text-[#babac4]">
          {brandLogo && (
            <Image
              src={brandLogo}
              alt={product.brand}
              width={18}
              height={18}
              className="flex-shrink-0"
              loading="lazy"
            />
          )}
          <span className="text-xs font-black uppercase tracking-[0.16em]">
            {product.brand}
          </span>
        </div>

        <h2
          className="min-h-[3.3rem] text-[1.22rem] font-black leading-tight text-white md:text-[1.5rem]"
          dir="auto"
        >
          {productName}
        </h2>

        {description && (
          <p className="mt-3 min-h-[3.3rem] text-sm leading-7 text-[#b8b8c2]">
            {description.length > 88 ? `${description.slice(0, 88)}...` : description}
          </p>
        )}

        <div className="mt-4">
          <div className="flex items-end gap-2">
            <strong className="text-[1.8rem] font-black leading-none text-[#ff3351] md:text-[2rem]">
              ₪{displayPrice.toLocaleString()}
            </strong>
            {displayOldPrice && (
              <span className="pb-1 text-sm text-[#777782] line-through">
                ₪{displayOldPrice.toLocaleString()}
              </span>
            )}
          </div>

          {monthly && months > 0 && (
            <div className="mt-2 text-sm font-semibold text-[#ff9cb0]">
              ₪{monthly.toLocaleString()} × {months}
              <span className="mr-1 text-xs font-medium text-[#b8b8c2]">
                {lang === "he" ? "לחודש" : "شهريًا"}
              </span>
            </div>
          )}
        </div>

        {storage.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {storage.map((option, index) => (
              <button
                key={option}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelStorage(index);
                }}
                className={`min-w-[4.35rem] rounded-[10px] border px-3 py-1.5 text-xs font-bold transition-colors ${
                  selStorage === index
                    ? "border-[#ff3351]/50 bg-[#ff3351]/10 text-white"
                    : "border-[#53535e] bg-transparent text-[#d4d4dc] hover:border-[#ff3351]/35 hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {colors.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            {colors.slice(0, 6).map((color, index) => (
              <button
                key={`${color.hex}-${index}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelColor(index);
                }}
                title={getColorName(color, lang)}
                aria-label={getColorName(color, lang)}
                className="rounded-full transition-all"
                style={{
                  width: scr.mobile ? 19 : 21,
                  height: scr.mobile ? 19 : 21,
                  background: color.hex,
                  border:
                    selColor === index
                      ? "2px solid #ffffff"
                      : "2px solid rgba(255,255,255,0.18)",
                  boxShadow:
                    selColor === index
                      ? "0 0 0 2px rgba(255,51,81,0.55)"
                      : "none",
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5 text-xs font-semibold ${stockLabel.className}`}
          >
            {stockLabel.icon}
            {stockLabel.text}
          </span>

          {product.featured && (
            <span className="hidden items-center gap-1 rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5 text-xs font-semibold text-[#d8d8df] md:inline-flex">
              <ShieldCheck size={13} />
              {t("store.freeShipping")}
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          {selectionIncomplete && (
            <div className="mb-3 text-sm font-bold text-[#ffcc77]">
              {needsColor && needsStorage
                ? t("store.selectColorAndStorage")
                : needsColor
                  ? t("store.selectColor")
                  : t("store.selectStorage")}
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={selectionIncomplete || stockVal === 0}
            className="w-full rounded-full border-2 border-[#ff0e34] px-4 py-3 text-sm font-black text-[#ff4b66] transition-colors hover:bg-[#ff0e34]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("store.addToCart")}
          </button>
        </div>
      </div>
    </Link>
  );
});
