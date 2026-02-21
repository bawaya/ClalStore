"use client";

import { useState, useMemo, useCallback } from "react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "./StoreHeader";
import { HeroCarousel } from "./HeroCarousel";
import { ProductCard } from "./ProductCard";
import { LinePlans } from "./LinePlans";
import { Footer } from "@/components/website/sections";
import type { Product, Hero, LinePlan } from "@/types/database";

// Fallback products when DB is empty (development)
const FALLBACK_PRODUCTS: Product[] = [
  { id: "d1", type: "device", brand: "Samsung", name_ar: "Galaxy S25 Ultra", name_he: "", price: 4298, old_price: undefined, cost: 3200, stock: 10, sold: 45, image_url: undefined, gallery: [], colors: [{ hex: "#1a1a2e", name_ar: "أسود", name_he: "" }, { hex: "#c0c0c0", name_ar: "فضي", name_he: "" }], storage_options: ["512GB", "256GB"], specs: { screen: '6.9"', camera: "200MP", battery: "5000mAh", cpu: "SD 8 Elite", ram: "12GB" }, active: true, featured: true, created_at: "", updated_at: "" },
  { id: "d2", type: "device", brand: "Apple", name_ar: "iPhone 17", name_he: "", price: 3598, old_price: undefined, cost: 2800, stock: 8, sold: 32, image_url: undefined, gallery: [], colors: [{ hex: "#5a6a7a", name_ar: "أزرق", name_he: "" }, { hex: "#d8a0c8", name_ar: "وردي", name_he: "" }], storage_options: ["512GB", "256GB"], specs: { screen: '6.3"', camera: "48MP", battery: "4500mAh", cpu: "A19", ram: "8GB" }, active: true, featured: true, created_at: "", updated_at: "" },
  { id: "d3", type: "device", brand: "Samsung", name_ar: "Z Flip 6", name_he: "", price: 1890, old_price: 3449, cost: 1500, stock: 3, sold: 18, image_url: undefined, gallery: [], colors: [{ hex: "#3a3a4a", name_ar: "أسود", name_he: "" }], storage_options: ["256GB"], specs: { screen: '6.7"', camera: "50MP", battery: "4000mAh" }, active: true, featured: false, created_at: "", updated_at: "" },
  { id: "d4", type: "device", brand: "Xiaomi", name_ar: "14T Pro", name_he: "", price: 2499, old_price: 2899, cost: 1800, stock: 6, sold: 12, image_url: undefined, gallery: [], colors: [{ hex: "#1a1a2e", name_ar: "أسود", name_he: "" }], storage_options: ["512GB", "256GB"], specs: { screen: '6.67"', camera: "50MP", battery: "5000mAh" }, active: true, featured: false, created_at: "", updated_at: "" },
  { id: "a1", type: "accessory", brand: "Samsung", name_ar: "Buds 3 Pro", name_he: "", price: 899, old_price: 999, cost: 500, stock: 20, sold: 28, image_url: undefined, gallery: [], colors: [], storage_options: [], specs: {}, active: true, featured: false, created_at: "", updated_at: "" },
  { id: "a2", type: "accessory", brand: "Apple", name_ar: "AirPods Pro 2", name_he: "", price: 999, old_price: undefined, cost: 650, stock: 15, sold: 35, image_url: undefined, gallery: [], colors: [], storage_options: [], specs: {}, active: true, featured: true, created_at: "", updated_at: "" },
  { id: "a3", type: "accessory", brand: "Samsung", name_ar: "شاحن 45W", name_he: "", price: 149, old_price: undefined, cost: 60, stock: 50, sold: 80, image_url: undefined, gallery: [], colors: [], storage_options: [], specs: {}, active: true, featured: false, created_at: "", updated_at: "" },
  { id: "a4", type: "accessory", brand: "Apple", name_ar: "كفر MagSafe", name_he: "", price: 199, old_price: 249, cost: 80, stock: 30, sold: 22, image_url: undefined, gallery: [], colors: [], storage_options: [], specs: {}, active: true, featured: false, created_at: "", updated_at: "" },
];

interface Props {
  products: Product[];
  heroes: Hero[];
  linePlans: LinePlan[];
}

export function StoreClient({ products, heroes, linePlans }: Props) {
  const scr = useScreen();
  const { t } = useLang();
  const [typeCat, setTypeCat] = useState("all");
  const [brandCat, setBrandCat] = useState("all");
  const [search, setSearch] = useState("");
  const [smartSearching, setSmartSearching] = useState(false);
  const [smartResults, setSmartResults] = useState<Product[] | null>(null);
  const [smartSuggestion, setSmartSuggestion] = useState("");

  const items = products.length > 0 ? products : FALLBACK_PRODUCTS;

  const brands = useMemo(
    () => [...new Set(items.map((p) => p.brand))],
    [items]
  );

  // Check if query is "smart" (3+ words or has smart keywords)
  const isSmartQuery = useCallback((q: string): boolean => {
    const words = q.trim().split(/\s+/);
    if (words.length >= 3) return true;
    const smartWords = [
      "تحت", "فوق", "أحسن", "أرخص", "أفضل", "أغلى", "أقوى",
      "كاميرا", "بطارية", "شاشة", "مقاوم",
      "under", "over", "best", "cheap", "camera", "battery",
    ];
    return smartWords.some((w) => q.toLowerCase().includes(w));
  }, []);

  // Smart search handler
  const handleSmartSearch = useCallback(async () => {
    if (!search.trim() || smartSearching) return;
    setSmartSearching(true);
    setSmartSuggestion("");
    try {
      const res = await fetch(`/api/store/smart-search?q=${encodeURIComponent(search.trim())}`);
      const data = await res.json();
      if (data.success) {
        setSmartResults(data.products || []);
        setSmartSuggestion(data.suggestion || "");
      }
    } catch {}
    setSmartSearching(false);
  }, [search, smartSearching]);

  // Handle search input keydown
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isSmartQuery(search)) {
      e.preventDefault();
      handleSmartSearch();
    }
  };

  // Clear smart search
  const clearSmartSearch = () => {
    setSmartResults(null);
    setSmartSuggestion("");
    setSearch("");
  };

  const filtered = useMemo(() => {
    // If smart search results exist, show them
    if (smartResults !== null) return smartResults;

    let list = items;
    // Type filter
    if (typeCat === "device") list = list.filter((p) => p.type === "device");
    else if (typeCat === "accessory") list = list.filter((p) => p.type === "accessory");
    // Brand filter
    if (brandCat !== "all") list = list.filter((p) => p.brand === brandCat);
    // Search (local — for short queries)
    if (search.trim() && !isSmartQuery(search)) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name_ar.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.name_he && p.name_he.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, typeCat, brandCat, search, smartResults, isSmartQuery]);

  const typeCategories = [
    { key: "all", label: t("store.all") },
    { key: "device", label: t("store.devices") },
    { key: "accessory", label: t("store.accessories") },
  ];

  const gridCols = scr.mobile
    ? "repeat(2, 1fr)"
    : scr.tablet
      ? "repeat(3, 1fr)"
      : "repeat(4, 1fr)";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <HeroCarousel heroes={heroes} />

      <div
        className="max-w-[1200px] mx-auto"
        style={{ padding: scr.mobile ? "12px 14px 30px" : "20px 28px 40px" }}
      >
        {/* Search */}
        <div className="mb-3" style={{ marginBottom: scr.mobile ? 12 : 20 }}>
          <div className="flex gap-1.5">
            <div className={`flex-1 flex items-center gap-1.5 rounded-xl border ${
              isSmartQuery(search) ? "border-purple-500/50 bg-purple-500/5" : "border-surface-border bg-surface-elevated"
            }`}
              style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}>
              <span className="text-sm opacity-30">{isSmartQuery(search) ? "✨" : "⌕"}</span>
              <input
                className="flex-1 bg-transparent border-none text-white outline-none"
                style={{ fontSize: scr.mobile ? 12 : 14 }}
                placeholder="ابحث... أو اكتب مثلاً: أحسن هاتف تحت 3000"
                value={search}
                onChange={(e) => { setSearch(e.target.value); if (smartResults) setSmartResults(null); }}
                onKeyDown={handleSearchKeyDown}
              />
              {smartSearching && (
                <span className="text-purple-400 text-xs animate-pulse">🧠</span>
              )}
              {search && (
                <button onClick={smartResults ? clearSmartSearch : () => setSearch("")} className="text-muted text-xs cursor-pointer">✕</button>
              )}
            </div>
            {isSmartQuery(search) && !smartSearching && (
              <button
                onClick={handleSmartSearch}
                className="px-3 rounded-xl text-xs font-medium text-white"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
              >
                ✨ بحث ذكي
              </button>
            )}
          </div>

          {/* Smart search suggestion hints */}
          {!search && !smartResults && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["أحسن هاتف سامسونج", "هاتف تحت 2000", "إكسسوارات iPhone", "هاتف بطارية قوية"].map((hint) => (
                <button
                  key={hint}
                  onClick={() => { setSearch(hint); }}
                  className="whitespace-nowrap text-[11px] px-2.5 py-1 rounded-lg border border-purple-500/20 text-purple-300/70 hover:bg-purple-500/10 transition-colors cursor-pointer"
                >
                  ✨ {hint}
                </button>
              ))}
            </div>
          )}

          {/* Smart search results banner */}
          {smartResults !== null && (
            <div className="flex items-center justify-between mt-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-xs text-purple-300">
                ✨ {smartSuggestion || `وجدنا ${smartResults.length} منتج`}
              </span>
              <button onClick={clearSmartSearch} className="text-[10px] text-purple-400 hover:text-white cursor-pointer">
                ✕ مسح
              </button>
            </div>
          )}
        </div>

        {/* Type filter */}
        <div
          className="flex gap-1 mb-2 overflow-x-auto"
          style={{ flexWrap: scr.desktop ? "wrap" : "nowrap" }}
        >
          {typeCategories.map((c) => (
            <button
              key={c.key}
              onClick={() => setTypeCat(c.key)}
              className={`chip whitespace-nowrap ${typeCat === c.key ? "chip-active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Brand filter */}
        <div
          className="flex gap-1 mb-3 overflow-x-auto"
          style={{
            marginBottom: scr.mobile ? 12 : 20,
            flexWrap: scr.desktop ? "wrap" : "nowrap",
          }}
        >
          <button
            onClick={() => setBrandCat("all")}
            className={`chip whitespace-nowrap ${brandCat === "all" ? "chip-active" : ""}`}
          >
            {t("store.allBrands")}
          </button>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setBrandCat(b)}
              className={`chip whitespace-nowrap ${brandCat === b ? "chip-active" : ""}`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-dim">
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-sm">{t("store.outOfStock")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3.5">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Lines */}
        <LinePlans plans={linePlans} />
      </div>

      <Footer />
    </div>
  );
}
