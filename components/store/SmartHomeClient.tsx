"use client";

import Link from "next/link";
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

const KIND_ENTRIES = Object.entries(APPLIANCE_KINDS) as [
  ApplianceKind,
  (typeof APPLIANCE_KINDS)["robot_vacuum"],
][];

function getFilterButtonClass(active: boolean) {
  return `rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
    active
      ? "border-[#ff3351]/45 bg-[#ff3351]/10 text-white"
      : "border-[#363640] bg-white/[0.02] text-[#d4d4dc] hover:border-[#ff3351]/35 hover:text-white"
  }`;
}

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
      list = list.filter(
        (p) => p.appliance_kind && kindSet.has(p.appliance_kind as ApplianceKind)
      );
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

  const shellClass =
    "rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.24)]";
  const inputClass =
    "w-full rounded-2xl border border-[#3a3a44] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#8f8f99] focus:border-[#ff3351]/45 focus:bg-white/[0.05]";

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
      }}
    >
      <StoreHeader />
      <StickyCartBar />

      <div
        className="mx-auto max-w-[1540px]"
        style={{ padding: scr.mobile ? "16px 14px 84px" : "24px 24px 110px" }}
      >
        <section className="mb-4 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {t("store.smartHomeTitle")}
              </span>
              <h1 className="mb-1 mt-3 font-black text-white" style={{ fontSize: scr.mobile ? 22 : 28 }}>
                {t("store.smartHomeTitle")}
              </h1>
              <p className="max-w-xl text-sm leading-8 text-[#b8b8c2]">
                {t("store.smartHomeSubtitle")}
              </p>
              <div className="mt-4">
                <Link
                  href="/store"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-4 text-xs font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
                >
                  {t("nav.store")}
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">{brands.length}</strong>
                <span className="text-sm text-[#b8b8c2]">{t("store.allBrands")}</span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">{filtered.length}</strong>
                <span className="text-sm text-[#b8b8c2]">{lang === "he" ? "מוצרים" : "منتجات"}</span>
              </div>
            </div>
          </div>
        </section>

        <div className={`${shellClass} mb-4 p-4 md:p-5`}>
          <div className="mb-3">
            <div className="flex items-center gap-2 rounded-2xl border border-[#3a3a44] bg-white/[0.03] px-4 py-3">
              <span className="text-sm text-[#8f8f99]">⌕</span>
              <input
                className="flex-1 border-none bg-transparent text-white outline-none placeholder:text-[#8f8f99]"
                style={{ fontSize: scr.mobile ? 12 : 14 }}
                placeholder={t("store.smartHomeSearchPh")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t("store.search")}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs text-[#b8b8c2] transition-colors hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <span className="w-full py-1 text-[10px] text-[#8f8f99] md:w-auto md:me-2">
              {t("store.smartHomeKinds")}
            </span>
            {KIND_ENTRIES.map(([key, meta]) => {
              const on = kindSet?.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleKind(key)}
                  className={getFilterButtonClass(Boolean(on))}
                >
                  {meta.icon} {lang === "he" ? meta.labelHe : meta.label}
                </button>
              );
            })}
            {kindSet && (
              <button
                type="button"
                onClick={() => setKindSet(null)}
                className="text-[10px] font-bold text-[#ff8da0] underline"
              >
                {t("store.all")}
              </button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBrandCat("all")}
              className={getFilterButtonClass(brandCat === "all")}
            >
              {t("store.allBrands")}
            </button>
            {brands.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrandCat(b)}
                className={getFilterButtonClass(brandCat === b)}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-[#8f8f99]">{t("store.smartHomeMaxPrice")}</span>
              <input
                type="number"
                min={0}
                className={`${inputClass} w-32`}
                dir="ltr"
                placeholder="₪"
                value={maxPrice}
                onChange={(e) => {
                  const v = e.target.value;
                  setMaxPrice(v === "" ? "" : Math.max(0, Number(v)));
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-[#8f8f99]">{t("store.smartHomeMinWarranty")}</span>
              <input
                type="number"
                min={0}
                max={120}
                className={`${inputClass} w-28`}
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
        </div>

        {filtered.length === 0 ? (
          <div className={`${shellClass} py-16 text-center`}>
            <div className="mb-3 text-4xl">🏠</div>
            <div className="text-sm text-[#b8b8c2]">{t("store.outOfStock")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3.5 lg:grid-cols-4">
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
