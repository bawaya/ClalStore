"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { calcDiscount, getColorName, getProductName } from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import {
  trackAddToCart,
  trackViewProduct,
} from "@/components/shared/Analytics";
import { StoreHeader } from "./StoreHeader";
import { StickyCartBar } from "./StickyCartBar";
import { ProductCard } from "./ProductCard";
import { ProductReviews } from "./ProductReviews";
import { Footer } from "@/components/website/sections";
import { ToastContainer } from "@/components/ui/Toast";
import { ProductAssistantWidget } from "./ProductAssistantWidget";
import { APPLIANCE_KINDS, INSTALLMENTS_BY_TYPE } from "@/lib/constants";
import type {
  Product,
  ProductColor,
  ProductVariant,
  ProductVariantKind,
} from "@/types/database";

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

function getVariantStock(
  product: Product,
  variant: ProductVariant | null
): number {
  if (variant && variant.stock !== undefined && variant.stock !== null) {
    if (variant.stock > 0) return variant.stock;
    if (product.stock > 0) return product.stock;
    return 0;
  }
  return product.stock;
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

export function ProductDetailClient({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const addItem = useCart((s) => s.addItem);
  const { toasts, show } = useToast();
  const colors0 = (product.colors || []) as ProductColor[];
  const storage0 = product.storage_options || [];
  const [selColor, setSelColor] = useState(colors0.length === 1 ? 0 : -1);
  const [selStorage, setSelStorage] = useState(storage0.length <= 1 ? 0 : -1);
  const [selImage, setSelImage] = useState(0);

  const colors = (product.colors || []) as ProductColor[];
  const storage = product.storage_options || [];
  const specs = (product.specs || {}) as Record<string, string>;
  const activeVariant = getActiveVariant(product, selStorage < 0 ? 0 : selStorage);
  const { price: displayPrice, old_price: displayOldPrice } = getDisplayPrice(
    product,
    activeVariant
  );
  const variantStock = getVariantStock(product, activeVariant);
  const discount = displayOldPrice
    ? calcDiscount(displayPrice, displayOldPrice)
    : 0;
  const productName = getProductName(product, lang);
  const activeColor = selColor >= 0 ? colors[selColor] : undefined;
  const colorName = activeColor ? getColorName(activeColor, lang) : undefined;
  const needsColor = colors.length > 0 && selColor < 0;
  const needsStorage = storage.length > 1 && selStorage < 0;
  const selectionIncomplete = needsColor || needsStorage;
  const warrantyKey = getWarrantyKey(product);
  const months = INSTALLMENTS_BY_TYPE[product.type] || 0;
  const monthly = activeVariant?.monthly_price;
  const brandLogo = getBrandLogo(product.brand);

  const allImages: string[] = [];
  if (product.image_url) allImages.push(product.image_url);
  if (product.gallery?.length) allImages.push(...product.gallery.filter(Boolean));
  colors.forEach((color) => {
    if (color.image && !allImages.includes(color.image)) {
      allImages.push(color.image);
    }
  });

  const handleColorSelect = (index: number) => {
    setSelColor(index);
    const selectedImage = colors[index]?.image;
    if (!selectedImage) return;
    const imageIndex = allImages.indexOf(selectedImage);
    if (imageIndex >= 0) setSelImage(imageIndex);
  };

  const handleAdd = () => {
    if (selectionIncomplete || variantStock === 0) return;
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
    trackAddToCart(productName, displayPrice);
    show(t("detail.addedToCart"));
  };

  useEffect(() => {
    trackViewProduct(productName, product.price);
  }, [productName, product.price]);

  const specLabels: Record<string, string> = {
    screen: t("detail.screen"),
    camera: t("detail.camera"),
    front_camera: t("detail.frontCamera"),
    battery: t("detail.battery"),
    cpu: t("detail.cpu"),
    ram: t("detail.ram"),
    weight: t("detail.weight"),
    os: t("detail.os"),
    waterproof: t("detail.waterproof"),
    sim: "SIM",
    network: t("detail.network"),
    charging: t("detail.charging"),
    bluetooth: "Bluetooth",
    usb: "USB",
    nfc: "NFC",
    gps: t("detail.gps"),
    sensors: t("detail.sensors"),
    dimensions: t("detail.dimensions"),
  };

  const stockTone =
    variantStock === 0
      ? {
          className: "text-[#ff9494]",
          icon: <AlertTriangle size={14} />,
          text: t("store.outOfStock"),
        }
      : variantStock <= 5
        ? {
            className: "text-[#ffd282]",
            icon: <AlertTriangle size={14} />,
            text:
              lang === "he"
                ? `נשארו ${variantStock} יחידות בלבד`
                : `باقي ${variantStock} قطع فقط`,
          }
        : {
            className: "text-[#95e4ab]",
            icon: <CheckCircle2 size={14} />,
            text: t("store.inStock"),
          };

  const detailCopy =
    lang === "he"
      ? {
          breadcrumb: "החנות / פרטי מוצר",
          gallery: "גלריית המוצר",
          summary: "כל פרטי הבחירה והמפרט במקום אחד",
          trustOne: "אחריות רשמית",
          trustTwo: "מחיר ברור",
          trustThree: "התאמה למלאי",
          chooseColor: "בחירת צבע",
          chooseStorage:
            product.type === "appliance" &&
            (product.variant_kind as ProductVariantKind | undefined) === "model"
              ? t("detail.variantModel")
              : t("detail.storage"),
          specsTitle: t("detail.specs"),
          descriptionTitle: t("detail.description"),
          relatedTitle: t("detail.similar"),
        }
      : {
          breadcrumb: "المتجر / تفاصيل المنتج",
          gallery: "معرض المنتج",
          summary: "كل عناصر القرار في مكان واحد",
          trustOne: "ضمان رسمي",
          trustTwo: "سعر واضح",
          trustThree: "مطابقة للمخزون",
          chooseColor: "اختيار اللون",
          chooseStorage:
            product.type === "appliance" &&
            (product.variant_kind as ProductVariantKind | undefined) === "model"
              ? t("detail.variantModel")
              : t("detail.storage"),
          specsTitle: t("detail.specs"),
          descriptionTitle: t("detail.description"),
          relatedTitle: t("detail.similar"),
        };

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 22%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 28%)",
      }}
    >
      <StoreHeader showBack />
      <StickyCartBar />

      <div
        className="mx-auto max-w-[1540px]"
        style={{ padding: scr.mobile ? "16px 14px 36px" : "24px 24px 48px" }}
      >
        <section className="mb-4 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
            {detailCopy.breadcrumb}
          </span>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(400px,520px)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-[28px] border border-[#33333c] bg-[linear-gradient(180deg,#1d1d22_0%,#131317_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.26)]">
              <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{ minHeight: scr.mobile ? 300 : 520 }}
              >
                <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,51,81,0.16),transparent_70%)]" />
                {allImages.length > 0 ? (
                  <Image
                    src={allImages[selImage] || allImages[0]}
                    alt={productName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="object-contain p-8 drop-shadow-[0_24px_28px_rgba(0,0,0,0.24)]"
                    priority
                  />
                ) : (
                  <span className="text-white/20">
                    <Smartphone size={scr.mobile ? 72 : 96} />
                  </span>
                )}
              </div>

              <div className="border-t border-[#2b2b34] px-4 py-4">
                <div className="mb-3 text-sm font-semibold text-[#d7d7df]">
                  {detailCopy.gallery}
                </div>
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {allImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        onClick={() => setSelImage(index)}
                        className={`relative h-[64px] w-[64px] flex-shrink-0 overflow-hidden rounded-2xl border ${
                          selImage === index
                            ? "border-[#ff3351]/55 bg-[#ff3351]/10"
                            : "border-[#3a3a44] bg-[#18181d]"
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`${productName} ${index + 1}`}
                          fill
                          sizes="64px"
                          className="object-contain p-2"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#33333c] bg-[linear-gradient(180deg,#1d1d22_0%,#131317_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.26)] md:px-6 md:py-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {product.featured && (
                  <span className="rounded-full bg-[#ff0e34] px-3 py-1 text-xs font-black text-white">
                    {t("store.bestSeller")}
                  </span>
                )}
                {discount > 0 && (
                  <span className="rounded-full border border-[#ff3351]/15 bg-[#ff3351]/10 px-3 py-1 text-xs font-black text-[#ffd7de]">
                    -{discount}%
                  </span>
                )}
                {warrantyKey && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#ff3351]/15 bg-[#ff3351]/10 px-3 py-1 text-xs font-black text-[#ffd7de]">
                    <ShieldCheck size={13} />
                    {t(warrantyKey)}
                  </span>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2 text-[#c4c4cc]">
                {brandLogo && (
                  <Image
                    src={brandLogo}
                    alt={product.brand}
                    width={22}
                    height={22}
                    loading="lazy"
                  />
                )}
                <span className="text-sm font-black uppercase tracking-[0.18em]">
                  {product.brand}
                </span>
              </div>

              <h1
                className="text-2xl font-black leading-tight text-white md:text-[2.5rem]"
                dir="auto"
              >
                {productName}
              </h1>

              <p className="mt-3 text-sm leading-8 text-[#b8b8c2] md:text-base">
                {detailCopy.summary}
              </p>

              <div className="mt-5">
                <div className="flex flex-wrap items-end gap-3">
                  <strong className="text-[2.1rem] font-black leading-none text-[#ff3351] md:text-[3rem]">
                    ₪{displayPrice.toLocaleString()}
                  </strong>
                  {displayOldPrice && (
                    <span className="pb-1 text-base text-[#7a7a84] line-through">
                      ₪{displayOldPrice.toLocaleString()}
                    </span>
                  )}
                </div>

                {monthly && months > 0 && (
                  <div className="mt-2 text-sm font-semibold text-[#ff9eb1]">
                    ₪{monthly.toLocaleString()} × {months}
                    <span className="mr-1 text-xs font-medium text-[#b8b8c2]">
                      {lang === "he" ? "לחודש" : "شهريًا"}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5 text-xs font-semibold text-[#d7d7de]">
                  {detailCopy.trustOne}
                </span>
                <span className="rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5 text-xs font-semibold text-[#d7d7de]">
                  {detailCopy.trustTwo}
                </span>
                <span className="rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5 text-xs font-semibold text-[#d7d7de]">
                  {detailCopy.trustThree}
                </span>
              </div>

              {(product.type === "appliance" ||
                product.type === "tv" ||
                product.type === "computer" ||
                product.type === "tablet" ||
                product.type === "network") &&
                ((product.warranty_months != null && product.warranty_months > 0) ||
                  product.model_number ||
                  product.appliance_kind) && (
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#d7d7de]">
                    {product.warranty_months != null &&
                      product.warranty_months > 0 && (
                        <span className="rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5">
                          {t("detail.warranty")}: {product.warranty_months}{" "}
                          {lang === "he" ? "חודש" : "شهر"}
                        </span>
                      )}
                    {product.model_number && (
                      <span
                        className="rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5"
                        dir="ltr"
                      >
                        {t("detail.modelNumber")}: {product.model_number}
                      </span>
                    )}
                    {product.appliance_kind &&
                      APPLIANCE_KINDS[
                        product.appliance_kind as keyof typeof APPLIANCE_KINDS
                      ] && (
                        <span className="rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5">
                          {
                            APPLIANCE_KINDS[
                              product.appliance_kind as keyof typeof APPLIANCE_KINDS
                            ].icon
                          }{" "}
                          {lang === "he"
                            ? APPLIANCE_KINDS[
                                product.appliance_kind as keyof typeof APPLIANCE_KINDS
                              ].labelHe
                            : APPLIANCE_KINDS[
                                product.appliance_kind as keyof typeof APPLIANCE_KINDS
                              ].label}
                        </span>
                      )}
                  </div>
                )}

              {colors.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-[#d7d7de]">
                    {detailCopy.chooseColor}
                    {colorName ? `: ${colorName}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color, index) => (
                      <button
                        key={`${color.hex}-${index}`}
                        type="button"
                        onClick={() => handleColorSelect(index)}
                        aria-pressed={selColor === index}
                        aria-label={`${detailCopy.chooseColor}: ${getColorName(
                          color,
                          lang
                        )}`}
                        className="rounded-full transition-all"
                        style={{
                          width: scr.mobile ? 30 : 34,
                          height: scr.mobile ? 30 : 34,
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
                </div>
              )}

              {storage.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-[#d7d7de]">
                    {detailCopy.chooseStorage}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {storage.map((option, index) => (
                      <button
                        key={`${option}-${index}`}
                        type="button"
                        onClick={() => setSelStorage(index)}
                        aria-pressed={selStorage === index}
                        className={`rounded-2xl border px-3 py-2 text-sm font-bold transition-colors ${
                          selStorage === index
                            ? "border-[#ff3351]/45 bg-[#ff3351]/10 text-white"
                            : "border-[#53535e] bg-transparent text-[#d4d4dc] hover:border-[#ff3351]/35 hover:text-white"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border border-[#3a3a44] bg-black/10 px-3 py-1.5 text-xs font-semibold ${stockTone.className}`}
                >
                  {stockTone.icon}
                  {stockTone.text}
                </span>
              </div>

              {selectionIncomplete && (
                <div className="mt-5 rounded-2xl border border-[#4c3d1f] bg-[#2b2412] px-4 py-3 text-sm font-bold text-[#ffcf79]">
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
                className="mt-5 w-full rounded-full border-2 border-[#ff0e34] px-4 py-4 text-sm font-black text-[#ff4c67] transition-colors hover:bg-[#ff0e34]/10 disabled:cursor-not-allowed disabled:opacity-40 md:text-base"
              >
                {variantStock === 0
                  ? t("detail.unavailable")
                  : t("store.addToCart")}
              </button>
            </div>
          </div>
        </section>

        {Object.keys(specs).length > 0 && (
          <section className="mb-4 rounded-[28px] border border-[#33333c] bg-[linear-gradient(180deg,#1b1b20_0%,#131317_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.22)] md:px-6 md:py-6">
            <h2 className="text-xl font-black text-white">
              {detailCopy.specsTitle}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Object.entries(specs)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-2xl border border-[#30303a] bg-white/[0.03] px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-white">
                      {value}
                    </span>
                    <span className="text-sm text-[#a5a5af]">
                      {specLabels[key] || key}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {((lang === "he" && product.description_he) || product.description_ar) && (
          <section className="mb-4 rounded-[28px] border border-[#33333c] bg-[linear-gradient(180deg,#1b1b20_0%,#131317_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.22)] md:px-6 md:py-6">
            <h2 className="text-xl font-black text-white">
              {detailCopy.descriptionTitle}
            </h2>
            <p className="mt-4 text-sm leading-8 text-[#b8b8c2] md:text-base">
              {lang === "he"
                ? product.description_he || product.description_ar
                : product.description_ar}
            </p>
          </section>
        )}

        <ProductReviews productId={product.id} />

        {related.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-4 text-center text-xl font-black text-white md:text-2xl">
              {detailCopy.relatedTitle}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ToastContainer toasts={toasts} />

      <ProductAssistantWidget page="product" product={product} />

      <Footer />
    </div>
  );
}
