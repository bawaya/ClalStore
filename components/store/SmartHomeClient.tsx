"use client";

import { useMemo, useState } from "react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "./StoreHeader";
import { StickyCartBar } from "./StickyCartBar";
import { ProductCard } from "./ProductCard";
import { Footer } from "@/components/website/sections";
import { ProductAssistantWidget } from "./ProductAssistantWidget";
import { APPLIANCE_KINDS } from "@/lib/constants";
import type { ApplianceKind, Product } from "@/types/database";

const KIND_ENTRIES = Object.entries(APPLIANCE_KINDS) as [ApplianceKind, (typeof APPLIANCE_KINDS)["robot_vacuum"]][];

interface Props {
  products: Product[];
}

export function SmartHomeClient({ products }: Props) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const [brandCat, setBrandCat] = useState("all");
  const [search, setSearch] = useState("");
  const [kindSet, setKindSet] = useState<Set<ApplianceKind> | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minWarranty, setMinWarranty] = useState<number | "">("");

  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand))].filter(Boolean).sort(),
    [products]
  );

  const toggleKind = (k: ApplianceKind) => {
    setKindSet((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next.size === 0 ? null : next;
    });
  };

  const filtered = useMemo(() => {
    let list = products;
    if (brandCat !== "all") list = list.filter((p) => p.brand === brandCat);
    if (kindSet && kindSet.size > 0) {
      list = list.filter((p) => p.appliance_kind && kindSet.has(p.appliance_kind as ApplianceKind));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name_ar.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.name_he && p.name_he.toLowerCase().includes(q)) ||
          (p.model_number && p.model_number.toLowerCase().includes(q))
      );
    }
    if (maxPrice !== "" && maxPrice > 0) {
      list = list.filter((p) => p.price <= maxPrice);
    }
    if (minWarranty !== "" && minWarranty >= 0) {
      list = list.filter((p) => (p.warranty_months ?? 0) >= minWarranty);
    }
    return list;
  }, [products, brandCat, kindSet, search, maxPrice, minWarranty]);

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <StickyCartBar />

      <section
        className="border-b border-surface-border"
        style={{
          background: "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(196,16,64,0.08) 100%)",
        }}
      >
        <div className="max-w-[1200px] mx-auto" style={{ padding: scr.mobile ? "20px 14px" : "28px 28px" }}>
          <h1 className="font-black text-white mb-1" style={{ fontSize: scr.mobile ? 22 : 28 }}>
            {t("store.smartHomeTitle")}
          </h1>
          <p className="text-muted text-sm max-w-xl leading-relaxed">{t("store.smartHomeSubtitle")}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <a
              href="/store"
              className="chip text-xs border border-surface-border hover:border-brand/40 transition-colors"
            >
              ← {t("nav.store")} ({t("store.devices")})
            </a>
          </div>
        </div>
      </section>

      <div
        className="max-w-[1200px] mx-auto"
        style={{ padding: scr.mobile ? "12px 14px 80px" : "20px 28px 100px" }}
      >
        <div className="mb-3">
          <div className="glass-card-static flex items-center gap-2 rounded-xl" style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}>
            <span className="text-sm opacity-40">⌕</span>
            <input
              className="flex-1 bg-transparent border-none text-white outline-none"
              style={{ fontSize: scr.mobile ? 12 : 14 }}
              placeholder={t("store.smartHomeSearchPh")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("store.search")}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-muted text-xs cursor-pointer">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] text-muted w-full md:w-auto md:me-2 py-1">{t("store.smartHomeKinds")}</span>
          {KIND_ENTRIES.map(([key, meta]) => {
            const on = kindSet?.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleKind(key)}
                className={`chip whitespace-nowrap text-[11px] ${on ? "chip-active" : ""}`}
              >
                {meta.icon} {lang === "he" ? meta.labelHe : meta.label}
              </button>
            );
          })}
          {kindSet && (
            <button type="button" onClick={() => setKindSet(null)} className="text-[10px] text-brand underline ms-1">
              {t("store.all")}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-3 items-center">
          <button
            type="button"
            onClick={() => setBrandCat("all")}
            className={`chip whitespace-nowrap ${brandCat === "all" ? "chip-active" : ""}`}
          >
            {t("store.allBrands")}
          </button>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrandCat(b)}
              className={`chip whitespace-nowrap ${brandCat === b ? "chip-active" : ""}`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4 items-end">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted">{t("store.smartHomeMaxPrice")}</span>
            <input
              type="number"
              min={0}
              className="input text-xs w-28"
              dir="ltr"
              placeholder="₪"
              value={maxPrice}
              onChange={(e) => {
                const v = e.target.value;
                setMaxPrice(v === "" ? "" : Math.max(0, Number(v)));
              }}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted">{t("store.smartHomeMinWarranty")}</span>
            <input
              type="number"
              min={0}
              max={120}
              className="input text-xs w-24"
              dir="ltr"
              placeholder={lang === "he" ? "חודשים" : "شهور"}
              value={minWarranty}
              onChange={(e) => {
                const v = e.target.value;
                setMinWarranty(v === "" ? "" : Math.max(0, Number(v)));
              }}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <div className="text-4xl mb-2">🏠</div>
            <div className="text-sm">{t("store.outOfStock")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3.5">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      <ProductAssistantWidget page="smart-home" />

      <Footer />
    </div>
  );
}
