"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "./StoreHeader";
// StickyCartBar is now mounted globally in app/layout.tsx via PublicChrome
import { HeroCarousel } from "./HeroCarousel";
import { ProductCard } from "./ProductCard";
import { LinePlans } from "./LinePlans";
import { ReviewsSection } from "./ReviewsSection";
import { Footer } from "@/components/website/sections";
import type { Hero, LinePlan, Product } from "@/types/database";

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "d1",
    type: "device",
    brand: "Samsung",
    name_ar: "Galaxy S25 Ultra",
    name_he: "",
    price: 4298,
    old_price: undefined,
    cost: 3200,
    stock: 10,
    sold: 45,
    image_url: undefined,
    gallery: [],
    colors: [
      { hex: "#1a1a2e", name_ar: "أسود", name_he: "" },
      { hex: "#c0c0c0", name_ar: "فضي", name_he: "" },
    ],
    storage_options: ["512GB", "256GB"],
    variants: [],
    specs: {
      screen: '6.9"',
      camera: "200MP",
      battery: "5000mAh",
      cpu: "SD 8 Elite",
      ram: "12GB",
    },
    active: true,
    featured: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "d2",
    type: "device",
    brand: "Apple",
    name_ar: "iPhone 17",
    name_he: "",
    price: 3598,
    old_price: undefined,
    cost: 2800,
    stock: 8,
    sold: 32,
    image_url: undefined,
    gallery: [],
    colors: [
      { hex: "#5a6a7a", name_ar: "أزرق", name_he: "" },
      { hex: "#f1c3d8", name_ar: "وردي", name_he: "" },
    ],
    storage_options: ["512GB", "256GB"],
    variants: [],
    specs: {
      screen: '6.3"',
      camera: "48MP",
      battery: "4500mAh",
      cpu: "A19",
      ram: "8GB",
    },
    active: true,
    featured: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "d3",
    type: "device",
    brand: "Xiaomi",
    name_ar: "14T Pro",
    name_he: "",
    price: 2499,
    old_price: 2899,
    cost: 1800,
    stock: 6,
    sold: 12,
    image_url: undefined,
    gallery: [],
    colors: [{ hex: "#1a1a2e", name_ar: "أسود", name_he: "" }],
    storage_options: ["512GB", "256GB"],
    variants: [],
    specs: {
      screen: '6.67"',
      camera: "50MP",
      battery: "5000mAh",
    },
    active: true,
    featured: false,
    created_at: "",
    updated_at: "",
  },
  {
    id: "a1",
    type: "accessory",
    brand: "Apple",
    name_ar: "AirPods Pro 2",
    name_he: "",
    price: 999,
    old_price: undefined,
    cost: 650,
    stock: 15,
    sold: 35,
    image_url: undefined,
    gallery: [],
    colors: [],
    storage_options: [],
    variants: [],
    specs: {},
    active: true,
    featured: true,
    created_at: "",
    updated_at: "",
  },
];

interface Props {
  products: Product[];
  heroes: Hero[];
  linePlans: LinePlan[];
}

function getFilterButtonClass(active: boolean) {
  return `rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
    active
      ? "border-[#ff3351]/45 bg-[#ff3351]/10 text-white"
      : "border-[#363640] bg-white/[0.02] text-[#d4d4dc] hover:border-[#ff3351]/35 hover:text-white"
  }`;
}

export function StoreClient({ products, heroes, linePlans }: Props) {
  const scr = useScreen();
  const searchParams = useSearchParams();
  const { t, lang } = useLang();
  const [typeCat, setTypeCat] = useState<"device" | "accessory">("device");
  const [brandCat, setBrandCat] = useState("all");
  const [search, setSearch] = useState("");
  const [smartSearching, setSmartSearching] = useState(false);
  const [smartResults, setSmartResults] = useState<Product[] | null>(null);
  const [smartSuggestion, setSmartSuggestion] = useState("");

  const items = useMemo(
    () =>
      products.length > 0
        ? products
        : process.env.NODE_ENV === "production"
          ? []
          : FALLBACK_PRODUCTS,
    [products]
  );

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch(q);
    if (!q) {
      setSmartResults(null);
      setSmartSuggestion("");
    }
  }, [searchParams]);

  const isSmartQuery = useCallback((q: string): boolean => {
    const words = q.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 3) return true;
    const smartWords = [
      "تحت",
      "فوق",
      "أفضل",
      "أرخص",
      "أقوى",
      "كاميرا",
      "بطارية",
      "شاشة",
      "under",
      "over",
      "best",
      "cheap",
      "camera",
      "battery",
    ];
    return smartWords.some((word) => q.toLowerCase().includes(word));
  }, []);

  const handleSmartSearch = useCallback(async () => {
    if (!search.trim() || smartSearching) return;
    setSmartSearching(true);
    setSmartSuggestion("");
    try {
      const res = await fetch(
        `/api/store/smart-search?q=${encodeURIComponent(search.trim())}`
      );
      const data = await res.json();
      if (data.success) {
        setSmartResults(data.products || []);
        setSmartSuggestion(data.suggestion || "");
      }
    } catch (err) {
      console.error("Smart search failed:", err);
    }
    setSmartSearching(false);
  }, [search, smartSearching]);

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isSmartQuery(search)) {
      e.preventDefault();
      void handleSmartSearch();
    }
  };

  const clearSmartSearch = () => {
    setSmartResults(null);
    setSmartSuggestion("");
    setSearch("");
  };

  const typeLabels = {
    device: lang === "he" ? "סמארטפונים" : "الهواتف",
    accessory: lang === "he" ? "אביזרים" : "الإكسسوارات",
  };

  const brands = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter((product) => product.type === typeCat)
            .map((product) => product.brand)
        ),
      ].sort(),
    [items, typeCat]
  );

  const filtered = useMemo(() => {
    if (smartResults !== null) return smartResults;

    let list = items.filter((product) => product.type === typeCat);

    if (brandCat !== "all") {
      list = list.filter((product) => product.brand === brandCat);
    }

    if (search.trim() && !isSmartQuery(search)) {
      const q = search.toLowerCase();
      list = list.filter(
        (product) =>
          product.name_ar.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          (product.name_he && product.name_he.toLowerCase().includes(q))
      );
    }

    const indexMap = new Map(items.map((product, idx) => [product.id, idx]));
    return [...list].sort(
      (a, b) => (indexMap.get(a.id) ?? 999) - (indexMap.get(b.id) ?? 999)
    );
  }, [items, typeCat, brandCat, search, smartResults, isSmartQuery]);

  useEffect(() => {
    setBrandCat("all");
  }, [typeCat]);

  const intro =
    lang === "he"
      ? {
          title: "ממשק חנות כהה ומסודר שמוביל את העין למוצר ולמחיר",
          subtitle:
            "העמוד הזה בנוי בסגנון חנויות המכשירים הרשמיות: ראש ברור, סינון ישיר, כרטיסי מוצר נקיים ומעט הדגשות אדומות.",
          results: "תוצאות מוצגות",
          filterTitle: "סינון התוצאות",
          filterSubtitle: "חיפוש ישיר, מותגים וסוגי מוצרים",
          typeTitle: "סוג מוצר",
          brandTitle: "מותג",
          hintsTitle: "חיפושים מהירים",
          toolbarTitle: "מראה חנות מסודר ורשמי",
          toolbarText:
            "המוצר מופיע ראשון, אחר כך המחיר, ואז ההחלטה. בלי זוהר מיותר ובלי עומס חזותי.",
          smartLabel: "חיפוש חכם",
          clear: "ניקוי",
          foundPrefix: "מציג",
          noResults: "לא נמצאו מוצרים תואמים כרגע.",
        }
      : {
          title: "واجهة متجر داكنة ومنظمة تقود العين إلى المنتج والسعر",
          subtitle:
            "هذه الصفحة مبنية بروح متاجر الأجهزة الرسمية: رأس واضح، تصفية مباشرة، بطاقات مرتبة، ولمسات حمراء محدودة بدل الضجيج البصري.",
          results: "نتيجة ظاهرة",
          filterTitle: "تنقية النتائج",
          filterSubtitle: "بحث مباشر، العلامات، ونوع المنتج",
          typeTitle: "نوع المنتج",
          brandTitle: "العلامة",
          hintsTitle: "اقتراحات سريعة",
          toolbarTitle: "ترتيب متجر رسمي وواضح",
          toolbarText:
            "المنتج يظهر أولًا، ثم السعر، ثم القرار. من دون لمعات مزعجة أو ازدحام غير ضروري.",
          smartLabel: "بحث ذكي",
          clear: "مسح",
          foundPrefix: "يعرض",
          noResults: "لا توجد منتجات مطابقة حاليًا.",
        };

  const quickHints =
    lang === "he"
      ? [
          "המכשיר הטוב ביותר עד 3000",
          "אביזרי iPhone",
          "מכשיר עם סוללה חזקה",
        ]
      : [
          "أفضل هاتف تحت 3000",
          "إكسسوارات iPhone",
          "هاتف ببطارية قوية",
        ];

  const toolbarPills = [
    typeLabels[typeCat],
    brandCat === "all"
      ? lang === "he"
        ? "כל המותגים"
        : "كل العلامات"
      : brandCat,
    search.trim()
      ? `${lang === "he" ? "חיפוש" : "بحث"}: ${search.trim()}`
      : smartResults !== null
        ? intro.smartLabel
        : lang === "he"
          ? "תצוגת כרטיסים"
          : "عرض بطاقات",
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
      <HeroCarousel heroes={heroes} />

      <div
        className="mx-auto max-w-[1540px]"
        style={{ padding: scr.mobile ? "16px 14px 84px" : "24px 24px 110px" }}
      >
        <section className="mb-4 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {typeLabels[typeCat]}
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight md:text-[2.6rem]">
                {intro.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                {intro.subtitle}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {filtered.length}
                </strong>
                <span className="text-sm text-[#b8b8c2]">{intro.results}</span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {brands.length}
                </strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "מותגים" : "علامات متاحة"}
                </span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {smartResults !== null
                    ? lang === "he"
                      ? "חכם"
                      : "ذكي"
                    : lang === "he"
                      ? "ישיר"
                      : "مباشر"}
                </strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "מסלול החיפוש" : "مسار البحث"}
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
                    {lang === "he" ? "חיפוש" : "البحث"}
                  </summary>
                  <div className="space-y-3 px-4 pb-4">
                    <label className="flex min-h-[48px] items-center rounded-2xl border border-[#4f4f5a] bg-white/[0.03] px-3">
                      <input
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#9c9ca8]"
                        placeholder={
                          lang === "he"
                            ? "חיפוש בשם, מותג או דגם"
                            : "ابحث باسم المنتج أو العلامة"
                        }
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          if (smartResults) setSmartResults(null);
                        }}
                        onKeyDown={handleSearchKeyDown}
                        aria-label={t("store.search")}
                      />
                    </label>

                    {isSmartQuery(search) && (
                      <button
                        type="button"
                        onClick={() => void handleSmartSearch()}
                        disabled={smartSearching}
                        className="w-full rounded-full border border-[#ff0e34] px-4 py-2 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10 disabled:opacity-50"
                      >
                        {smartSearching
                          ? lang === "he"
                            ? "מחפש..."
                            : "جارٍ البحث..."
                          : intro.smartLabel}
                      </button>
                    )}

                    {smartResults !== null && (
                      <div className="rounded-2xl border border-[#ff3351]/20 bg-[#ff3351]/10 px-4 py-3 text-sm text-[#ffd5dc]">
                        <div>{smartSuggestion || `${filtered.length}`}</div>
                        <button
                          type="button"
                          onClick={clearSmartSearch}
                          className="mt-2 text-xs font-bold text-[#ff9fb0]"
                        >
                          {intro.clear}
                        </button>
                      </div>
                    )}
                  </div>
                </details>

                <details open className="rounded-[20px] border border-[#2e2e37] bg-white/[0.02]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white">
                    {intro.typeTitle}
                  </summary>
                  <div className="grid gap-2 px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => setTypeCat("device")}
                      className={getFilterButtonClass(typeCat === "device")}
                    >
                      {typeLabels.device}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeCat("accessory")}
                      className={getFilterButtonClass(typeCat === "accessory")}
                    >
                      {typeLabels.accessory}
                    </button>
                  </div>
                </details>

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

                {!search && smartResults === null && (
                  <details open className="rounded-[20px] border border-[#2e2e37] bg-white/[0.02]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-white">
                      {intro.hintsTitle}
                    </summary>
                    <div className="grid gap-2 px-4 pb-4">
                      {quickHints.map((hint) => (
                        <button
                          key={hint}
                          type="button"
                          onClick={() => setSearch(hint)}
                          className="rounded-2xl border border-[#363640] bg-white/[0.02] px-3 py-2 text-right text-sm text-[#d9d9df] transition-colors hover:border-[#ff3351]/35 hover:text-white"
                        >
                          {hint}
                        </button>
                      ))}
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
                    {intro.foundPrefix} {filtered.length}{" "}
                    {lang === "he" ? "מוצרים" : "منتجًا"}
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
                <div className="text-4xl">🔍</div>
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

        <div className="mt-6">
          <LinePlans plans={linePlans} />
        </div>

        <div className="mt-6">
          <ReviewsSection />
        </div>
      </div>

      <Footer />
    </div>
  );
}
