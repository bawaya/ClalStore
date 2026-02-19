"use client";

import { useState } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { calcDiscount } from "@/lib/utils";
import { getBrandLogo } from "@/lib/brand-logos";
import { StoreHeader } from "./StoreHeader";
import { ProductCard } from "./ProductCard";
import { Footer } from "@/components/website/sections";
import type { Product, ProductColor } from "@/types/database";

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
  const [selColor, setSelColor] = useState(0);
  const [selStorage, setSelStorage] = useState(0);

  const colors = (p.colors || []) as ProductColor[];
  const storage = p.storage_options || [];
  const specs = (p.specs || {}) as Record<string, string>;
  const disc = p.old_price ? calcDiscount(p.price, p.old_price) : 0;

  /* Device names always English (name_ar holds English names like "Galaxy S25 Ultra") */
  const productName = p.name_ar;
  const colorName = colors[selColor]?.name_ar;

  const specLabels: Record<string, string> = {
    screen: t("detail.screen"), camera: t("detail.camera"), battery: t("detail.battery"),
    cpu: t("detail.cpu"), ram: "RAM", weight: t("detail.weight"),
  };

  const handleAdd = () => {
    addItem({
      productId: p.id,
      name: productName,
      brand: p.brand,
      type: p.type as "device" | "accessory",
      price: p.price,
      image: p.image_url || undefined,
      color: colorName,
      storage: storage[selStorage],
    });
    show(t("detail.addedToCart"));
  };

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />

      <div
        className="max-w-[900px] mx-auto"
        style={{ padding: scr.mobile ? "12px 14px 30px" : "20px 28px 40px" }}
      >
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 28 }}>
          {/* Image */}
          <div
            className="bg-surface-elevated rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              width: scr.mobile ? "100%" : 380,
              height: scr.mobile ? 220 : 380,
              marginBottom: scr.mobile ? 12 : 0,
            }}
          >
            {(() => {
              const colorImg = colors[selColor]?.image;
              const imgSrc = colorImg || p.image_url;
              return imgSrc ? (
                <img src={imgSrc} alt={productName} className="max-h-[90%] max-w-[90%] object-contain" />
              ) : (
                <span className="opacity-15" style={{ fontSize: scr.mobile ? 60 : 90 }}>
                  {p.type === "device" ? "📱" : "🔌"}
                </span>
              );
            })()}
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
                  <img src={getBrandLogo(p.brand)!} alt={p.brand} style={{ width: scr.mobile ? 18 : 22, height: scr.mobile ? 18 : 22 }} />
                )}
                <span className="text-white font-extrabold uppercase tracking-wide" style={{ fontSize: scr.mobile ? 14 : 16 }}>{p.brand}</span>
              </div>
            </div>

            <h1 className="font-black mb-2" style={{ fontSize: scr.mobile ? 20 : 28 }} dir="ltr">
              {productName}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 24 : 32 }}>
                ₪{p.price.toLocaleString()}
              </span>
              {p.old_price && (
                <>
                  <span className="text-dim line-through" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                    ₪{p.old_price.toLocaleString()}
                  </span>
                  <span className="badge bg-state-error/15 text-state-error">-{disc}%</span>
                </>
              )}
            </div>

            {/* Type info */}
            {p.type === "device" && (
              <div className="bg-state-info/10 rounded-[10px] p-2 mb-3" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                <span className="text-state-info">{t("detail.deviceNote")}</span>
              </div>
            )}
            {p.type === "accessory" && (
              <div className="bg-state-success/10 rounded-[10px] p-2 mb-3" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                <span className="text-state-success">{t("detail.accessoryNote")}</span>
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
                      key={i}
                      onClick={() => setSelColor(i)}
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

            {/* Storage */}
            {storage.length > 0 && (
              <div className="mb-4">
                <div className="text-muted mb-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>{t("detail.storage")}</div>
                <div className="flex gap-1">
                  {storage.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSelStorage(i)}
                      className={`chip ${selStorage === i ? "chip-active" : ""}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            {p.stock > 0 && p.stock <= 5 && (
              <div className="text-state-warning mb-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                {t("detail.lowStock").replace("{n}", String(p.stock))}
              </div>
            )}
            {p.stock === 0 && (
              <div className="text-state-error mb-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                {t("store.outOfStock")}
              </div>
            )}

            {/* Add to cart */}
            <button
              onClick={handleAdd}
              disabled={p.stock === 0}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: scr.mobile ? 14 : 16, padding: "14px 20px" }}
            >
              {p.stock === 0 ? t("detail.unavailable") : `🛒 ${t("store.addToCart")}`}
            </button>
          </div>
        </div>

        {/* Specs */}
        {Object.keys(specs).length > 0 && (
          <div className="card mt-4 p-4" style={{ marginTop: scr.mobile ? 12 : 24 }}>
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
                  <div key={k} className="flex justify-between p-2 bg-surface-elevated rounded-[10px]">
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
          <div className="card mt-4 p-4">
            <h3 className="font-extrabold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 16 }}>
              {t("detail.description")}
            </h3>
            <p className="text-muted leading-relaxed text-right" style={{ fontSize: scr.mobile ? 11 : 13 }}>
              {lang === "he" ? (p.description_he || p.description_ar) : p.description_ar}
            </p>
          </div>
        )}

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

      {/* Toast */}
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 card border-state-success text-state-success font-bold z-[999] shadow-2xl"
          style={{ padding: scr.mobile ? "10px 24px" : "12px 32px", fontSize: scr.mobile ? 12 : 14 }}
        >
          {t.message}
        </div>
      ))}

      <Footer />
    </div>
  );
}
