"use client";

import { useState, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Scale, Smartphone, Plug, Truck, Camera, Battery, Cpu } from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { useCompare } from "@/lib/store/compare";
import { useWishlist } from "@/lib/store/wishlist";
import { calcDiscount, getProductName, getColorName, getDescription } from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import type { Product, ProductColor, ProductVariant } from "@/types/database";

/* ── variant helpers ── */
function getActiveVariant(p: Product, storageIdx: number): ProductVariant | null {
  const variants = p.variants || [];
  if (variants.length === 0) return null;
  const storage = p.storage_options || [];
  const selLabel = storage[storageIdx];
  return variants.find((v) => v.storage === selLabel) || variants[0] || null;
}

function getDisplayPrice(p: Product, variant: ProductVariant | null): { price: number; old_price?: number } {
  if (variant) return { price: variant.price, old_price: variant.old_price };
  return { price: p.price, old_price: p.old_price };
}

function _getTotalStock(p: Product): number {
  const variants = p.variants || [];
  if (variants.length === 0) return p.stock;
  return variants.reduce((sum, v) => sum + (v.stock ?? p.stock), 0);
}

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

export const ProductCard = memo(function ProductCard({ product: p }: { product: Product }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const addItem = useCart((s) => s.addItem);
  const addToCompare = useCompare((s) => s.addItem);
  const removeFromCompare = useCompare((s) => s.removeItem);
  const inCompare = useCompare((s) => s.items.some((i) => i.id === p.id));
  const addToWishlist = useWishlist((s) => s.addItem);
  const removeFromWishlist = useWishlist((s) => s.removeItem);
  const inWishlist = useWishlist((s) => s.items.some((i) => i.id === p.id));
  const colors = (p.colors || []) as ProductColor[];
  const storage = p.storage_options || [];
  const [selColor, setSelColor] = useState(colors.length === 1 ? 0 : -1);
  const [selStorage, setSelStorage] = useState(storage.length <= 1 ? 0 : -1);
  const [wishAnim, setWishAnim] = useState(false);
  const [compareToast, setCompareToast] = useState("");

  const needsColor = colors.length > 0 && selColor < 0;
  const needsStorage = storage.length > 1 && selStorage < 0;
  const selectionIncomplete = needsColor || needsStorage;

  const activeVariant = getActiveVariant(p, selStorage < 0 ? 0 : selStorage);
  const { price: displayPrice, old_price: displayOldPrice } = getDisplayPrice(p, activeVariant);
  const disc = displayOldPrice ? calcDiscount(displayPrice, displayOldPrice) : 0;

  const warrantyKey = getWarrantyKey(p);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectionIncomplete) return;
    const activeColor = selColor >= 0 ? colors[selColor] : undefined;
    addItem({
      productId: p.id,
      name: p.name_ar,
      name_he: p.name_he || undefined,
      brand: p.brand,
      type: p.type as "device" | "accessory",
      price: displayPrice,
      image: (activeColor?.image) || p.image_url || undefined,
      color: activeColor?.name_ar,
      color_he: activeColor?.name_he || undefined,
      storage: storage[selStorage],
    });
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(p.id);
    } else {
      const ok = addToCompare(p);
      if (!ok) {
        setCompareToast(t("compare.maxReached"));
        setTimeout(() => setCompareToast(""), 2000);
      }
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishAnim(true);
    setTimeout(() => setWishAnim(false), 300);
    if (inWishlist) {
      removeFromWishlist(p.id);
    } else {
      addToWishlist(p);
    }
  };

  return (
    <Link
      href={`/store/product/${p.id}`}
      className="glass-card overflow-hidden cursor-pointer relative group flex flex-col"
    >
      {/* ── Warranty / Promo Ribbon (top-right) ── */}
      {warrantyKey && (
        <div
          className="absolute top-0 z-10 font-extrabold text-white text-center leading-tight"
          style={{
            insetInlineEnd: 0,
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
          className="absolute z-10 text-white font-extrabold rounded-md"
          style={{
            background: "#c41040",
            fontSize: scr.mobile ? 9 : 11,
            padding: scr.mobile ? "2px 5px" : "3px 8px",
            top: scr.mobile ? 32 : 36,
            insetInlineStart: scr.mobile ? 6 : 8,
          }}
        >
          -{disc}%
        </span>
      )}

      {/* ── Wishlist Heart (top-left corner) ── */}
      <button
        onClick={handleWishlist}
        className={`glass-icon-btn absolute z-10 transition-all ${inWishlist ? "text-brand" : "text-white"}`}
        title={inWishlist ? t("wishlist.remove") : t("wishlist.add")}
        aria-label={inWishlist ? t("wishlist.remove") : t("wishlist.add")}
        style={{
          top: scr.mobile ? 6 : 8,
          insetInlineStart: scr.mobile ? 6 : 8,
          transform: wishAnim ? "scale(1.3)" : "scale(1)",
        }}
      >
        <Heart
          size={scr.mobile ? 14 : 16}
          {...(inWishlist ? { fill: "currentColor" } : {})}
        />
      </button>

      {/* ── Compare toast ── */}
      {compareToast && (
        <div
          className="absolute z-20 left-1/2 -translate-x-1/2 bg-surface-card border border-surface-border text-white text-center rounded-lg shadow-lg font-bold"
          style={{ bottom: scr.mobile ? 50 : 60, fontSize: scr.mobile ? 10 : 12, padding: "6px 14px", whiteSpace: "nowrap" }}
        >
          {compareToast}
        </div>
      )}

      {/* ── Product Image ── */}
      <div
        className="flex items-center justify-center overflow-hidden relative"
        style={{ height: scr.mobile ? 180 : 230 }}
      >
        {(() => {
          const colorImg = selColor >= 0 ? colors[selColor]?.image : undefined;
          const imgSrc = colorImg || p.image_url;
          return imgSrc ? (
            <Image
              src={imgSrc}
              alt={getProductName(p, lang)}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-contain drop-shadow-lg p-3"
              loading="lazy"
            />
          ) : (
            <span className="flex items-center justify-center">
              {p.type === "device" ? (
                <Smartphone size={scr.mobile ? 32 : 48} className="opacity-15" />
              ) : (
                <Plug size={scr.mobile ? 32 : 48} className="opacity-15" />
              )}
            </span>
          );
        })()}

        {/* Free shipping badge */}
        {p.featured && (
          <div
            className="absolute font-bold text-white rounded-full flex items-center justify-center text-center leading-tight gap-0.5"
            style={{
              bottom: scr.mobile ? 4 : 8,
              insetInlineStart: scr.mobile ? 4 : 8,
              width: scr.mobile ? 44 : 56,
              height: scr.mobile ? 44 : 56,
              background: "linear-gradient(135deg, #c41040 0%, #ff3366 100%)",
              fontSize: scr.mobile ? 7 : 8,
              boxShadow: "0 2px 8px rgba(196,16,64,0.5)",
              flexDirection: "column",
            }}
          >
            <Truck size={scr.mobile ? 10 : 12} />
            {t("store.freeShipping").split("\n").map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        )}

        {/* ── Compare button (bottom-right of image) ── */}
        <button
          onClick={handleCompare}
          className={`glass-icon-btn absolute z-10 ${inCompare ? "glass-icon-btn-active" : ""}`}
          title={inCompare ? t("compare.inCompare") : t("compare.add")}
          aria-label={inCompare ? t("compare.inCompare") : t("compare.add")}
          style={{
            bottom: scr.mobile ? 4 : 8,
            insetInlineEnd: scr.mobile ? 4 : 8,
          }}
        >
          <Scale size={scr.mobile ? 14 : 16} />
        </button>
      </div>

      {/* ── Info Section ── */}
      <div
        className="flex-1 flex flex-col"
        style={{ padding: scr.mobile ? "10px 10px 12px" : "14px 16px 16px" }}
      >
        {/* Brand + Name */}
        <div className="flex items-center gap-1.5 mb-0.5">
          {getBrandLogo(p.brand) && (
            <Image
              src={getBrandLogo(p.brand)!}
              alt={p.brand}
              width={scr.mobile ? 14 : 18}
              height={scr.mobile ? 14 : 18}
              className="flex-shrink-0"
              loading="lazy"
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
          {getProductName(p, lang)}
        </div>

        {/* Description (subtitle) */}
        {(() => {
          const desc = getDescription(p, lang);
          if (!desc) return null;
          return (
            <div
              className="text-[#71717a] leading-snug mb-1.5"
              style={{ fontSize: scr.mobile ? 9 : 11 }}
            >
              {desc.length > 60 ? desc.slice(0, 60) + "..." : desc}
            </div>
          );
        })()}

        {/* ── Quick Specs Strip (devices only) ── */}
        {p.type === "device" && p.specs && (() => {
          const s = p.specs as Record<string, string>;
          const items: { icon: React.ReactNode; val: string }[] = [];
          if (s.screen) {
            const m = s.screen.match(/([\d.]+)\s*inches?/i);
            if (m) items.push({ icon: <Smartphone size={10} />, val: `${m[1]}"` });
          }
          if (s.camera) {
            const m = s.camera.match(/([\d.]+)\s*MP/i);
            if (m) items.push({ icon: <Camera size={10} />, val: `${m[1]}MP` });
          }
          if (s.battery) {
            const m = s.battery.match(/([\d,]+)\s*mAh/i);
            if (m) items.push({ icon: <Battery size={10} />, val: `${m[1]}` });
          }
          if (s.ram) items.push({ icon: <Cpu size={10} />, val: s.ram });
          if (items.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1.5">
              {items.map((it, i) => (
                <span key={i} className="text-[#a1a1aa] font-semibold whitespace-nowrap inline-flex items-center gap-0.5" style={{ fontSize: scr.mobile ? 8 : 10 }}>
                  {it.icon} {it.val}
                </span>
              ))}
            </div>
          );
        })()}

        {/* ── Price ── */}
        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          {storage.length > 1 && (
            <span
              className="text-[#a1a1aa] font-bold"
              style={{ fontSize: scr.mobile ? 9 : 11 }}
            >
              {t("store2.startingFrom")}
            </span>
          )}
          <span
            className="font-black"
            style={{
              color: "#c41040",
              fontSize: scr.mobile ? 18 : 22,
            }}
          >
            ₪{displayPrice.toLocaleString()}
          </span>
          {displayOldPrice && (
            <span
              className="line-through text-[#52525b]"
              style={{ fontSize: scr.mobile ? 10 : 13 }}
            >
              ₪{displayOldPrice.toLocaleString()}
            </span>
          )}
        </div>
        {p.type === "device" && displayPrice > 0 && (
          <div className="mb-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>
            <span className="text-[#a78bfa] font-semibold">
              ₪{(activeVariant?.monthly_price ?? Math.ceil(displayPrice / 36)).toLocaleString()} × 36
            </span>
            <span className="text-[#a1a1aa] me-1" style={{ fontSize: scr.mobile ? 8 : 9 }}>{t("store2.monthly")}</span>
          </div>
        )}

        {/* ── Stock indicator ── */}
        {(() => {
          const variantStock = activeVariant?.stock;
          const stockVal = variantStock != null ? variantStock : p.stock;
          if (stockVal === 0) return (
            <div className="text-[#ef4444] font-bold mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              ❌ {t("store.outOfStock")}
            </div>
          );
          if (stockVal <= 5) return (
            <div className="text-[#f59e0b] font-bold mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              ⚠️ {lang === "ar" ? `باقي ${stockVal} قطع فقط!` : `נשארו ${stockVal} יחידות בלבד!`}
            </div>
          );
          return (
            <div className="text-[#22c55e] font-bold mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              ✅ {t("store.inStock")} ({stockVal})
            </div>
          );
        })()}

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
                key={c.hex}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelColor(i);
                }}
                title={getColorName(c, lang)}
                aria-label={getColorName(c, lang)}
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

        {/* ── Selection hint ── */}
        {selectionIncomplete && (
          <div
            className="text-center font-bold mb-1"
            style={{
              fontSize: scr.mobile ? 9 : 11,
              color: "#f59e0b",
            }}
          >
            {needsColor && needsStorage
              ? t("store.selectColorAndStorage")
              : needsColor
                ? t("store.selectColor")
                : t("store.selectStorage")}
          </div>
        )}

        {/* ── Add to Cart button ── */}
        <button
          onClick={handleAddToCart}
          disabled={selectionIncomplete}
          className="w-full cursor-pointer transition-all active:scale-[0.97] font-extrabold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border-brand bg-transparent text-brand hover:bg-brand/10"
          style={{
            borderWidth: "1.5px",
            borderStyle: "solid",
            padding: scr.mobile ? "7px 0" : "9px 0",
            fontSize: scr.mobile ? 12 : 14,
            marginTop: scr.mobile ? 4 : 6,
          }}
        >
          {t("store.addToCart")}
        </button>
      </div>
    </Link>
  );
});
