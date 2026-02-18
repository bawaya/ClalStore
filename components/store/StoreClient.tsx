"use client";

import { useState, useMemo } from "react";
import { useScreen } from "@/lib/hooks";
import { StoreHeader } from "./StoreHeader";
import { HeroCarousel } from "./HeroCarousel";
import { ProductCard } from "./ProductCard";
import { LinePlans } from "./LinePlans";
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
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");

  const items = products.length > 0 ? products : FALLBACK_PRODUCTS;

  const brands = useMemo(
    () => [...new Set(items.map((p) => p.brand))],
    [items]
  );

  const filtered = useMemo(() => {
    let list = items;
    if (cat === "device") list = list.filter((p) => p.type === "device");
    else if (cat === "accessory") list = list.filter((p) => p.type === "accessory");
    else if (cat !== "all") list = list.filter((p) => p.brand === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name_ar.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.name_he && p.name_he.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, cat, search]);

  const categories = [
    { key: "all", label: "الكل" },
    { key: "device", label: "📱 أجهزة" },
    { key: "accessory", label: "🔌 إكسسوارات" },
    ...brands.map((b) => ({ key: b, label: b })),
  ];

  const gridCols = scr.mobile
    ? "1fr 1fr"
    : scr.tablet
      ? "1fr 1fr 1fr"
      : "1fr 1fr 1fr 1fr";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <HeroCarousel heroes={heroes} />

      <div
        className="max-w-[1200px] mx-auto"
        style={{ padding: scr.mobile ? "12px 14px 30px" : "20px 28px 40px" }}
      >
        {/* Search */}
        <div className="flex gap-1.5 mb-3" style={{ marginBottom: scr.mobile ? 12 : 20 }}>
          <div className="flex-1 flex items-center gap-1.5 bg-surface-elevated rounded-xl border border-surface-border"
            style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}>
            <span className="text-sm opacity-30">⌕</span>
            <input
              className="flex-1 bg-transparent border-none text-white outline-none"
              style={{ fontSize: scr.mobile ? 12 : 14 }}
              placeholder="ابحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted text-xs cursor-pointer">✕</button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div
          className="flex gap-1 mb-3 overflow-x-auto"
          style={{
            marginBottom: scr.mobile ? 12 : 20,
            flexWrap: scr.desktop ? "wrap" : "nowrap",
          }}
        >
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`chip whitespace-nowrap ${cat === c.key ? "chip-active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-dim">
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-sm">لا توجد منتجات مطابقة</div>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: gridCols, gap: scr.mobile ? 8 : 14 }}>
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Lines */}
        <LinePlans plans={linePlans} />
      </div>
    </div>
  );
}
