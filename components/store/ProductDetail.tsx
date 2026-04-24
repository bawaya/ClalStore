"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { calcDiscount, getProductName, getColorName } from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import { trackAddToCart, trackViewProduct } from "@/components/shared/Analytics";
import { StoreHeader } from "./StoreHeader";
import { StickyCartBar } from "./StickyCartBar";
import { ProductCard } from "./ProductCard";
import { ProductReviews } from "./ProductReviews";
import { Footer } from "@/components/website/sections";
import { ToastContainer } from "@/components/ui/Toast";
import { ProductAssistantWidget } from "./ProductAssistantWidget";
import { APPLIANCE_KINDS, INSTALLMENTS_BY_TYPE } from "@/lib/constants";
import type { Product, ProductColor, ProductVariant, ProductVariantKind } from "@/types/database";

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

function getVariantStock(p: Product, variant: ProductVariant | null): number {
  if (variant && variant.stock !== undefined && variant.stock !== null) {
    if (variant.stock > 0) return variant.stock;
    if (p.stock > 0) return p.stock;
    return 0;
  }
  return p.stock;
}

export function ProductDetailClient({
  product: p,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const addItem = useCart((s) => s.addItem);
  const { toasts, show } = useToast();
  const colors0 = (p.colors || []) as ProductColor[];
  const storage0 = p.storage_options || [];
  const [selColor, setSelColor] = useState(colors0.length === 1 ? 0 : -1);
  const [selStorage, setSelStorage] = useState(storage0.length <= 1 ? 0 : -1);
  const [selImage, setSelImage] = useState(0);

  const colors = (p.colors || []) as ProductColor[];
  const storage = p.storage_options || [];
  const specs = (p.specs || {}) as Record<string, string>;

  const activeVariant = getActiveVariant(p, selStorage < 0 ? 0 : selStorage);
  const { price: displayPrice, old_price: displayOldPrice } = getDisplayPrice(p, activeVariant);
  const variantStock = getVariantStock(p, activeVariant);
  const disc = displayOldPrice ? calcDiscount(displayPrice, displayOldPrice) : 0;

  const productName = getProductName(p, lang);
  const activeColor = selColor >= 0 ? colors[selColor] : undefined;
  const colorName = activeColor ? getColorName(activeColor, lang) : undefined;

  const needsColor = colors.length > 0 && selColor < 0;
  const needsStorage = storage.length > 1 && selStorage < 0;
  const selectionIncomplete = needsColor || needsStorage;

  const allImages: string[] = [];
  if (p.image_url) allImages.push(p.image_url);
  if (p.gallery?.length) allImages.push(...p.gallery.filter(Boolean));
  colors.forEach((c) => { if (c.image && !allImages.includes(c.image)) allImages.push(c.image); });

  const handleColorSelect = (i: number) => {
    setSelColor(i);
    const cImg = colors[i]?.image;
    if (cImg) {
      const idx = allImages.indexOf(cImg);
      if (idx >= 0) setSelImage(idx);
    }
  };

  const specLabels: Record<string, string> = {
    screen: t("detail.screen"), camera: t("detail.camera"), front_camera: t("detail.frontCamera"), battery: t("detail.battery"),
    cpu: t("detail.cpu"), ram: t("detail.ram"), weight: t("detail.weight"),
    os: t("detail.os"), waterproof: t("detail.waterproof"), sim: "SIM",
    network: t("detail.network"), charging: t("detail.charging"),
    bluetooth: "Bluetooth", usb: "USB", nfc: "NFC", gps: t("detail.gps"),
    sensors: t("detail.sensors"), dimensions: t("detail.dimensions"),
  };

  const handleAdd = () => {
    if (selectionIncomplete) return;
    addItem({
      productId: p.id,
      name: p.name_ar,
      name_he: p.name_he || undefined,
      brand: p.brand,
      type: p.type,
      price: displayPrice,
      image: (activeColor?.image) || p.image_url || undefined,
      color: activeColor?.name_ar,
      color_he: activeColor?.name_he || undefined,
      storage: storage[selStorage],
    });
    trackAddToCart(productName, displayPrice);
    show(t("detail.addedToCart"));
  };

  useEffect(() => {
    trackViewProduct(productName, p.price);
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <StickyCartBar />

      <div
        className="max-w-[900px] mx-auto"
        style={{ padding: scr.mobile ? "12px 14px 30px" : "20px 28px 40px" }}
      >
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 28 }}>
          {/* Image Gallery */}
          <div className="flex-shrink-0" style={{ width: scr.mobile ? "100%" : 380, marginBottom: scr.mobile ? 12 : 0 }}>
            {/* Main Image */}
            <div
              className="glass-elevated flex items-center justify-center relative"
              style={{
                width: "100%",
                height: scr.mobile ? 260 : 380,
              }}
            >
              {allImages.length > 0 ? (
                <Image src={allImages[selImage] || allImages[0]} alt={productName} fill sizes="(max-width: 768px) 100vw, 380px" className="object-contain drop-shadow-lg p-4" priority />
              ) : (
                <span className="opacity-15" style={{ fontSize: scr.mobile ? 60 : 90 }}>
                  {p.type === "device" ? "📱" : p.type === "appliance" ? "🏠" : "🔌"}
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
                {allImages.map((img, i) => (
                  <button
                    key={img}
                    onClick={() => setSelImage(i)}
                    className="flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all border-0 glass-elevated relative"
                    style={{
                      width: scr.mobile ? 48 : 60,
                      height: scr.mobile ? 48 : 60,
                      outline: selImage === i ? "2px solid #c41040" : "1px solid #333",
                      opacity: selImage === i ? 1 : 0.6,
                    }}
                  >
                    <Image src={img} alt={`صورة المنتج ${i + 1}`} fill sizes="60px" className="object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              {p.featured && (
                <span className="badge" style={{ background: "rgba(196,16,64,0.15)", color: "#c41040" }}>
                  {t("store.bestSeller")}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {getBrandLogo(p.brand) && (
                  <Image src={getBrandLogo(p.brand)!} alt={p.brand} width={scr.mobile ? 18 : 22} height={scr.mobile ? 18 : 22} loading="lazy" />
                )}
                <span className="text-white font-extrabold uppercase tracking-wide" style={{ fontSize: scr.mobile ? 14 : 16 }}>{p.brand}</span>
              </div>
            </div>

            <h1 className="font-black mb-2" style={{ fontSize: scr.mobile ? 20 : 28 }} dir="ltr">
              {productName}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 24 : 32 }}>
                ₪{displayPrice.toLocaleString()}
              </span>
              {displayOldPrice && (
                <>
                  <span className="text-dim line-through" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                    ₪{displayOldPrice.toLocaleString()}
                  </span>
                  <span className="badge bg-state-error/15 text-state-error">-{disc}%</span>
                </>
              )}
            </div>
            {/* Cash price tag — eligible for cash or up to 18 interest-free installments */}
            {displayPrice > 0 && (INSTALLMENTS_BY_TYPE[p.type] || 0) > 0 && (
              <div className="mb-1 text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                💵 {lang === "he" ? "מזומן או עד 18 תשלומים ללא ריבית" : "نقد أو حتى 18 قسط بدون فوائد"}
              </div>
            )}
            {/* Long-term financed installment — only when admin set monthly_price explicitly */}
            {displayPrice > 0 && activeVariant?.monthly_price && (INSTALLMENTS_BY_TYPE[p.type] || 0) > 0 && (
              <div className="mb-4" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                <span className="text-[#a78bfa] font-bold">
                  أو ₪{activeVariant.monthly_price.toLocaleString()} × {INSTALLMENTS_BY_TYPE[p.type]}
                </span>
                <span className="text-muted me-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>{t("store2.monthlyInstallment")}</span>
              </div>
            )}

            {/* Type info */}
            {p.type === "device" && (
              <div className="glass-elevated rounded-button p-2 mb-3" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                <span className="text-state-info">{t("detail.deviceNote")}</span>
              </div>
            )}
            {p.type === "accessory" && (
              <div className="glass-elevated rounded-button p-2 mb-3" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                <span className="text-state-success">{t("detail.accessoryNote")}</span>
              </div>
            )}
            {p.type === "appliance" && (
              <div className="glass-elevated rounded-button p-2 mb-3" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                <span className="text-cyan-300/90">{t("detail.applianceNote")}</span>
              </div>
            )}

            {(p.type === "appliance" || p.type === "tv" || p.type === "computer" || p.type === "tablet" || p.type === "network") &&
              ((p.warranty_months != null && p.warranty_months > 0) || p.model_number || p.appliance_kind) && (
              <div className="flex flex-wrap gap-2 mb-3 text-[11px] text-muted">
                {p.warranty_months != null && p.warranty_months > 0 && (
                  <span className="badge bg-surface-elevated">
                    {t("detail.warranty")}: {p.warranty_months} {lang === "he" ? "חודשים" : "شهر"}
                  </span>
                )}
                {p.model_number && (
                  <span className="badge bg-surface-elevated" dir="ltr">
                    {t("detail.modelNumber")}: {p.model_number}
                  </span>
                )}
                {p.appliance_kind && APPLIANCE_KINDS[p.appliance_kind as keyof typeof APPLIANCE_KINDS] && (
                  <span className="badge bg-surface-elevated">
                    {APPLIANCE_KINDS[p.appliance_kind as keyof typeof APPLIANCE_KINDS].icon}{" "}
                    {lang === "he"
                      ? APPLIANCE_KINDS[p.appliance_kind as keyof typeof APPLIANCE_KINDS].labelHe
                      : APPLIANCE_KINDS[p.appliance_kind as keyof typeof APPLIANCE_KINDS].label}
                  </span>
                )}
              </div>
            )}

            {/* Colors */}
            {colors.length > 0 && (
              <div className="mb-3">
                <div className="text-muted mb-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                  {t("detail.color")} {colorName}
                </div>
                <div className="flex gap-1.5">
                  {colors.map((c, i) => (
                    <button
                      key={`${c.hex}-${i}`}
                      type="button"
                      onClick={() => handleColorSelect(i)}
                      aria-pressed={selColor === i}
                      aria-label={`${t("detail.color")}: ${getColorName(c, lang)}`}
                      className="rounded-full cursor-pointer transition-all"
                      style={{
                        width: scr.mobile ? 28 : 36,
                        height: scr.mobile ? 28 : 36,
                        background: c.hex,
                        border: selColor === i ? "3px solid #c41040" : "2px solid #333",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Storage / model options (hidden for color_only with no options) */}
            {storage.length > 0 && (
              <div className="mb-4">
                <div className="text-muted mb-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                  {p.type === "appliance" && (p.variant_kind as ProductVariantKind | undefined) === "model"
                    ? t("detail.variantModel")
                    : t("detail.storage")}
                </div>
                <div className="flex gap-1">
                  {storage.map((s, i) => (
                    <button
                      key={`${s}-${i}`}
                      type="button"
                      onClick={() => setSelStorage(i)}
                      aria-pressed={selStorage === i}
                      aria-label={`${t("detail.storage")}: ${s}`}
                      className={`chip ${selStorage === i ? "chip-active" : ""}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            {variantStock > 0 && variantStock <= 5 && (
              <div className="text-state-warning mb-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                {t("detail.lowStock").replace("{n}", String(variantStock))}
              </div>
            )}
            {variantStock === 0 && (
              <div className="text-state-error mb-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                {t("store.outOfStock")}
              </div>
            )}

            {/* Add to cart */}
            {selectionIncomplete && (
              <div
                className="glass-elevated rounded-button text-center font-bold mb-2"
                style={{
                  fontSize: scr.mobile ? 11 : 13,
                  color: "#f59e0b",
                  padding: scr.mobile ? "8px 12px" : "10px 16px",
                }}
              >
                {needsColor && needsStorage
                  ? t("store.selectColorAndStorage")
                  : needsColor
                    ? t("store.selectColor")
                    : t("store.selectStorage")}
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={variantStock === 0 || selectionIncomplete}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: scr.mobile ? 14 : 16, padding: "14px 20px" }}
            >
              {variantStock === 0 ? t("detail.unavailable") : `🛒 ${t("store.addToCart")}`}
            </button>
          </div>
        </div>

        {/* Specs */}
        {Object.keys(specs).length > 0 && (
          <div className="glass-card-static mt-4 p-4" style={{ marginTop: scr.mobile ? 12 : 24 }}>
            <h3 className="font-extrabold mb-2.5 text-right" style={{ fontSize: scr.mobile ? 12 : 16 }}>
              {t("detail.specs")}
            </h3>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}
            >
              {Object.entries(specs)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between p-2 glass-elevated rounded-button">
                    <span className="font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>{v}</span>
                    <span className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                      {specLabels[k] || k}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Description */}
        {((lang === "he" && p.description_he) || p.description_ar) && (
          <div className="glass-card-static mt-4 p-4">
            <h3 className="font-extrabold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 16 }}>
              {t("detail.description")}
            </h3>
            <p className="text-muted leading-relaxed text-right" style={{ fontSize: scr.mobile ? 11 : 13 }}>
              {lang === "he" ? (p.description_he || p.description_ar) : p.description_ar}
            </p>
          </div>
        )}

        {/* Reviews */}
        <ProductReviews productId={p.id} />

        {/* Related */}
        {related.length > 0 && (
          <div style={{ marginTop: scr.mobile ? 20 : 32 }}>
            <h3 className="font-extrabold text-center mb-3" style={{ fontSize: scr.mobile ? 14 : 18 }}>
              {t("detail.similar")}
            </h3>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}
            >
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} />

      <ProductAssistantWidget page="product" product={p} />

      <Footer />
    </div>
  );
}
