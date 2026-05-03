"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "./StoreHeader";
// StickyCartBar is now mounted globally in app/layout.tsx via PublicChrome
import { ProductCard } from "./ProductCard";
import { Footer } from "@/components/website/sections";
import { ProductAssistantWidget } from "./ProductAssistantWidget";
import type { Product } from "@/types/database";

type SubkindMap = Record<
  string,
  { label: string; labelHe: string; icon: string }
>;

interface Props {
  products: Product[];
  title: string;
  titleHe?: string;
  subtitle: string;
  subtitleHe?: string;
  backLabel?: string;
  subkindOptions?: SubkindMap | null;
  subkindRowLabel?: string;
  showPriceFilter?: boolean;
  showWarrantyFilter?: boolean;
  showScreenSizeFilter?: boolean;
  emptyIcon?: string;
}

function getFilterButtonClass(active: boolean) {
  return `rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
    active
      ? "border-[#ff3351]/45 bg-[#ff3351]/10 text-white"
      : "border-[#363640] bg-white/[0.02] text-[#d4d4dc] hover:border-[#ff3351]/35 hover:text-white"
  }`;
}

export function CategoryStorefront({
  products,
  title,
  titleHe,
  subtitle,
  subtitleHe,
  backLabel,
  subkindOptions,
  subkindRowLabel,
  showPriceFilter = true,
  showWarrantyFilter = false,
  showScreenSizeFilter = false,
  emptyIcon = "📦",
}: Props) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const searchParams = useSearchParams();
  const [brandCat, setBrandCat] = useState("all");
  const [search, setSearch] = useState("");
  const [kindSet, setKindSet] = useState<Set<string> | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minWarranty, setMinWarranty] = useState<number | "">("");
  const [sizeRange, setSizeRange] = useState<
    "" | "small" | "med" | "large" | "xl"
  >("");

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const brands = useMemo(
    () =>
      [...new Set(products.map((product) => product.brand))]
        .filter(Boolean)
        .sort(),
    [products]
  );

  const subkindEntries = subkindOptions ? Object.entries(subkindOptions) : [];

  const toggleKind = (key: string) => {
    setKindSet((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? null : next;
    });
  };

  const filtered = useMemo(() => {
    let list = products;

    if (brandCat !== "all") {
      list = list.filter((product) => product.brand === brandCat);
    }

    if (kindSet && kindSet.size > 0) {
      list = list.filter(
        (product) => product.subkind && kindSet.has(product.subkind as string)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (product) =>
          product.name_ar.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          (product.name_he && product.name_he.toLowerCase().includes(q)) ||
          (product.model_number &&
            product.model_number.toLowerCase().includes(q))
      );
    }

    if (maxPrice !== "" && maxPrice > 0) {
      list = list.filter((product) => product.price <= maxPrice);
    }

    if (minWarranty !== "" && minWarranty >= 0) {
      list = list.filter(
        (product) => (product.warranty_months ?? 0) >= minWarranty
      );
    }

    if (sizeRange) {
      list = list.filter((product) => {
        const size = Number(product.specs?.screen_size_inch || 0);
        if (!size) return false;
        if (sizeRange === "small") return size < 50;
        if (sizeRange === "med") return size >= 50 && size < 65;
        if (sizeRange === "large") return size >= 65 && size < 75;
        if (sizeRange === "xl") return size >= 75;
        return true;
      });
    }

    return list;
  }, [products, brandCat, kindSet, search, maxPrice, minWarranty, sizeRange]);

  const intro =
    lang === "he"
      ? {
          title: titleHe || title,
          subtitle: subtitleHe || subtitle,
          filterTitle: "סינון התוצאות",
          filterSubtitle: "מותגים, תתי-קטגוריות וחיפוש ישיר",
          toolbarTitle: "עמוד קטגוריה מסודר וברור",
          toolbarText:
            "אותו שקט חזותי, אותו מחיר מודגש, ואותה רשת כרטיסים שמתאימה לחנות מכשירים רשמית.",
          searchTitle: "חיפוש",
          brandTitle: "מותג",
          categoryTitle: subkindRowLabel || "קטגוריה",
          extraTitle: "מסננים נוספים",
          foundPrefix: "מציג",
          products: "מוצרים",
          noResults: "לא נמצאו מוצרים מתאימים בקטגוריה הזו.",
          maxPrice: "מחיר מקסימלי",
          minWarranty: "אחריות מינימלית",
          screenSize: "גודל מסך",
        }
      : {
          title,
          subtitle,
          filterTitle: "تنقية النتائج",
          filterSubtitle: "علامات، فئات فرعية، وبحث مباشر",
          toolbarTitle: "صفحة قسم مرتبة وواضحة",
          toolbarText:
            "نفس الهدوء البصري، ونفس إبراز السعر، ونفس شبكة البطاقات التي تناسب متجر أجهزة رسمي.",
          searchTitle: "البحث",
          brandTitle: "العلامة",
          categoryTitle: subkindRowLabel || "الفئة",
          extraTitle: "فلاتر إضافية",
          foundPrefix: "يعرض",
          products: "منتجًا",
          noResults: "لا توجد منتجات مطابقة داخل هذا القسم حاليًا.",
          maxPrice: "أقصى سعر",
          minWarranty: "أقل ضمان",
          screenSize: "حجم الشاشة",
        };

  const selectedKinds = kindSet
    ? subkindEntries
        .filter(([key]) => kindSet.has(key))
        .map(([, meta]) => (lang === "he" ? meta.labelHe : meta.label))
    : [];

  const toolbarPills = [
    intro.title,
    brandCat === "all"
      ? lang === "he"
        ? "כל המותגים"
        : "كل العلامات"
      : brandCat,
    selectedKinds[0] ||
      (subkindEntries.length > 0
        ? intro.categoryTitle
        : lang === "he"
          ? "תצוגת כרטיסים"
          : "عرض بطاقات"),
  ];

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 22%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 28%)",
      }}
    >
      <StoreHeader />

      <div
        className="mx-auto max-w-[1540px]"
        style={{ padding: scr.mobile ? "16px 14px 84px" : "24px 24px 110px" }}
      >
        <section className="mb-4 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {intro.categoryTitle}
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight md:text-[2.6rem]">
                {intro.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                {intro.subtitle}
              </p>
              <div className="mt-4">
                <LinkBack
                  href="/store"
                  label={backLabel || t("nav.store")}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {filtered.length}
                </strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "תוצאות" : "نتيجة"}
                </span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {brands.length}
                </strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "מותגים" : "علامات"}
                </span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {kindSet?.size || subkindEntries.length || "—"}
                </strong>
                <span className="text-sm text-[#b8b8c2]">
                  {subkindEntries.length > 0
                    ? lang === "he"
                      ? "תתי-קטגוריות"
                      : "فئات فرعية"
                    : lang === "he"
                      ? "סינון"
                      : "تصفية"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-[170px]">
            <div className="overflow-hidden rounded-[26px] border border-[#32323b] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.3)]">
              <div className="border-b border-[#282832] px-5 py-4">
                <strong className="block text-lg font-black text-white">
                  {intro.filterTitle}
                </strong>
                <span className="text-sm text-[#9b9ba6]">
                  {intro.filterSubtitle}
                </span>
              </div>

              <div className="space-y-3 p-4">
                <details open className="rounded-[20px] border border-[#2e2e37] bg-white/[0.02]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white">
                    {intro.searchTitle}
                  </summary>
                  <div className="px-4 pb-4">
                    <label className="flex min-h-[48px] items-center rounded-2xl border border-[#4f4f5a] bg-white/[0.03] px-3">
                      <input
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#9c9ca8]"
                        placeholder={
                          lang === "he"
                            ? "חיפוש לפי שם, מותג או דגם"
                            : "ابحث حسب الاسم أو العلامة أو الموديل"
                        }
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label={t("store.search")}
                      />
                    </label>
                  </div>
                </details>

                {subkindEntries.length > 0 && (
                  <details open className="rounded-[20px] border border-[#2e2e37] bg-white/[0.02]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white">
                      {intro.categoryTitle}
                    </summary>
                    <div className="grid gap-2 px-4 pb-4">
                      {subkindEntries.map(([key, meta]) => {
                        const active = kindSet?.has(key) ?? false;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleKind(key)}
                            className={getFilterButtonClass(active)}
                          >
                            {meta.icon} {lang === "he" ? meta.labelHe : meta.label}
                          </button>
                        );
                      })}

                      {kindSet && (
                        <button
                          type="button"
                          onClick={() => setKindSet(null)}
                          className="text-sm font-bold text-[#ff91a3]"
                        >
                          {t("store.all")}
                        </button>
                      )}
                    </div>
                  </details>
                )}

                <details open className="rounded-[20px] border border-[#2e2e37] bg-white/[0.02]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white">
                    {intro.brandTitle}
                  </summary>
                  <div className="grid gap-2 px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => setBrandCat("all")}
                      className={getFilterButtonClass(brandCat === "all")}
                    >
                      {t("store.allBrands")}
                    </button>
                    {brands.map((brand) => (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => setBrandCat(brand)}
                        className={getFilterButtonClass(brandCat === brand)}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </details>

                {(showPriceFilter || showWarrantyFilter || showScreenSizeFilter) && (
                  <details open className="rounded-[20px] border border-[#2e2e37] bg-white/[0.02]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white">
                      {intro.extraTitle}
                    </summary>
                    <div className="grid gap-3 px-4 pb-4">
                      {showScreenSizeFilter && (
                        <label className="grid gap-2 text-sm text-[#d6d6dd]">
                          <span>{intro.screenSize}</span>
                          <select
                            className="rounded-2xl border border-[#3a3a44] bg-[#17171b] px-3 py-2 text-sm text-white outline-none"
                            value={sizeRange}
                            onChange={(e) =>
                              setSizeRange(e.target.value as typeof sizeRange)
                            }
                          >
                            <option value="">—</option>
                            <option value="small">حتى 49</option>
                            <option value="med">50 - 64</option>
                            <option value="large">65 - 74</option>
                            <option value="xl">75+</option>
                          </select>
                        </label>
                      )}

                      {showPriceFilter && (
                        <label className="grid gap-2 text-sm text-[#d6d6dd]">
                          <span>{intro.maxPrice}</span>
                          <input
                            type="number"
                            min={0}
                            dir="ltr"
                            className="rounded-2xl border border-[#3a3a44] bg-[#17171b] px-3 py-2 text-sm text-white outline-none"
                            value={maxPrice}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMaxPrice(
                                value === "" ? "" : Math.max(0, Number(value))
                              );
                            }}
                          />
                        </label>
                      )}

                      {showWarrantyFilter && (
                        <label className="grid gap-2 text-sm text-[#d6d6dd]">
                          <span>{intro.minWarranty}</span>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            dir="ltr"
                            className="rounded-2xl border border-[#3a3a44] bg-[#17171b] px-3 py-2 text-sm text-white outline-none"
                            value={minWarranty}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMinWarranty(
                                value === "" ? "" : Math.max(0, Number(value))
                              );
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <section className="rounded-[20px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#131318_100%)] px-4 py-4 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  {toolbarPills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex min-h-[34px] items-center rounded-full border border-[#383842] bg-white/[0.03] px-4 text-sm font-semibold text-[#dbdbe1]"
                    >
                      {pill}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-[#30303a] bg-white/[0.03] px-4 py-2 text-sm text-[#e7e7eb]">
                    {intro.foundPrefix} {filtered.length} {intro.products}
                  </span>

                  <div className="inline-flex items-center gap-1 rounded-full border border-[#383842] bg-[#151519] px-1 py-1 text-xs">
                    <span className="rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 font-semibold text-white">
                      {lang === "he" ? "רשת" : "شبكة"}
                    </span>
                    <span className="px-3 py-1 text-[#9999a4]">
                      {lang === "he" ? "מורחב" : "موسع"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {filtered.length === 0 ? (
              <div className="rounded-[26px] border border-[#2f2f38] bg-[#17171b] px-6 py-14 text-center text-[#b8b8c2] shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
                <div className="text-4xl">{emptyIcon}</div>
                <div className="mt-3 text-sm">{intro.noResults}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductAssistantWidget page="smart-home" />

      <Footer />
    </div>
  );
}

function LinkBack({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-[42px] items-center rounded-full border border-[#353540] bg-[#17171b] px-4 text-sm font-semibold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
    >
      {label}
    </a>
  );
}
