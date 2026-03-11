"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  SlidersHorizontal,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Plug,
  Package,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Sparkles,
  Flame,
  CalendarDays,
} from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export type SortOption =
  | "default"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "best_selling"
  | "featured";

export interface FilterState {
  minPrice: number | null;
  maxPrice: number | null;
  brands: string[];
  type: "all" | "device" | "accessory";
  inStockOnly: boolean;
  sort: SortOption;
}

export const INITIAL_FILTERS: FilterState = {
  minPrice: null,
  maxPrice: null,
  brands: [],
  type: "all",
  inStockOnly: false,
  sort: "default",
};

interface Props {
  availableBrands: string[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function SearchFilters({ availableBrands, filters, onChange }: Props) {
  const scr = useScreen();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice !== null) count++;
    if (filters.maxPrice !== null) count++;
    if (filters.brands.length > 0) count++;
    if (filters.type !== "all") count++;
    if (filters.inStockOnly) count++;
    if (filters.sort !== "default") count++;
    return count;
  }, [filters]);

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange]
  );

  const clearAll = useCallback(() => {
    onChange({ ...INITIAL_FILTERS });
  }, [onChange]);

  useEffect(() => {
    if (!scr.mobile || !open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, scr.mobile]);

  useEffect(() => {
    if (open && scr.mobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, scr.mobile]);

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const sortOptions: { key: SortOption; label: string; icon: React.ReactNode }[] = [
    { key: "price_asc", label: t("store2.sortPriceLow"), icon: <ArrowDownNarrowWide size={14} /> },
    { key: "price_desc", label: t("store2.sortPriceHigh"), icon: <ArrowUpNarrowWide size={14} /> },
    { key: "newest", label: t("store2.sortNewest"), icon: <CalendarDays size={14} /> },
    { key: "best_selling", label: t("store2.sortBestSelling"), icon: <Flame size={14} /> },
    { key: "featured", label: t("store2.sortFeatured"), icon: <Sparkles size={14} /> },
  ];

  const filterContent = (
    <div className="space-y-1">
      {/* Sort By */}
      <FilterSection
        title={t("store2.sortBy")}
        expanded={expandedSection === "sort"}
        onToggle={() => toggleSection("sort")}
        scr={scr}
      >
        <div className="flex flex-wrap gap-1.5">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => update({ sort: filters.sort === opt.key ? "default" : opt.key })}
              className={`flex items-center gap-1.5 cursor-pointer transition-all font-semibold rounded-lg ${
                filters.sort === opt.key
                  ? "text-brand"
                  : "text-muted hover:text-white"
              }`}
              style={{
                fontSize: scr.mobile ? 11 : 12,
                padding: scr.mobile ? "6px 10px" : "6px 12px",
                background:
                  filters.sort === opt.key
                    ? "rgba(196,16,64,0.1)"
                    : "rgba(255,255,255,0.03)",
                border:
                  filters.sort === opt.key
                    ? "1px solid rgba(196,16,64,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection
        title={t("store2.priceRange")}
        expanded={expandedSection === "price"}
        onToggle={() => toggleSection("price")}
        scr={scr}
      >
        <div className="flex items-center gap-2">
          <PriceInput
            placeholder={t("store2.minPrice")}
            value={filters.minPrice}
            onChange={(v) => update({ minPrice: v })}
            scr={scr}
          />
          <span className="text-muted text-xs">—</span>
          <PriceInput
            placeholder={t("store2.maxPrice")}
            value={filters.maxPrice}
            onChange={(v) => update({ maxPrice: v })}
            scr={scr}
          />
          <span className="text-muted text-xs">₪</span>
        </div>
        {/* Quick price presets */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[1000, 2000, 3000, 5000].map((price) => (
            <button
              key={price}
              onClick={() => {
                if (filters.maxPrice === price) {
                  update({ maxPrice: null });
                } else {
                  update({ maxPrice: price });
                }
              }}
              className={`cursor-pointer transition-all font-semibold rounded-md ${
                filters.maxPrice === price ? "text-brand" : "text-muted"
              }`}
              style={{
                fontSize: scr.mobile ? 10 : 11,
                padding: "4px 10px",
                background:
                  filters.maxPrice === price
                    ? "rgba(196,16,64,0.1)"
                    : "rgba(255,255,255,0.03)",
                border:
                  filters.maxPrice === price
                    ? "1px solid rgba(196,16,64,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {t("store2.maxPrice")} ₪{price.toLocaleString()}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Type Filter */}
      <FilterSection
        title={t("store2.typeFilter")}
        expanded={expandedSection === "type"}
        onToggle={() => toggleSection("type")}
        scr={scr}
      >
        <div className="flex gap-1.5">
          {(
            [
              { key: "all", label: t("store.all"), icon: <Package size={14} /> },
              { key: "device", label: t("store.devices"), icon: <Smartphone size={14} /> },
              { key: "accessory", label: t("store.accessories"), icon: <Plug size={14} /> },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => update({ type: opt.key })}
              className={`flex items-center gap-1.5 cursor-pointer transition-all font-semibold rounded-lg flex-1 justify-center ${
                filters.type === opt.key
                  ? "text-brand"
                  : "text-muted hover:text-white"
              }`}
              style={{
                fontSize: scr.mobile ? 11 : 12,
                padding: scr.mobile ? "8px 0" : "8px 4px",
                background:
                  filters.type === opt.key
                    ? "rgba(196,16,64,0.1)"
                    : "rgba(255,255,255,0.03)",
                border:
                  filters.type === opt.key
                    ? "1px solid rgba(196,16,64,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Brand Filter */}
      <FilterSection
        title={t("store2.brandFilter")}
        expanded={expandedSection === "brand"}
        onToggle={() => toggleSection("brand")}
        scr={scr}
      >
        <div className="flex flex-wrap gap-1.5">
          {availableBrands.map((brand) => {
            const selected = filters.brands.includes(brand);
            return (
              <button
                key={brand}
                onClick={() => {
                  const next = selected
                    ? filters.brands.filter((b) => b !== brand)
                    : [...filters.brands, brand];
                  update({ brands: next });
                }}
                className={`flex items-center gap-1.5 cursor-pointer transition-all font-semibold rounded-lg ${
                  selected
                    ? "text-brand"
                    : "text-muted hover:text-white"
                }`}
                style={{
                  fontSize: scr.mobile ? 11 : 12,
                  padding: scr.mobile ? "6px 10px" : "6px 12px",
                  background: selected
                    ? "rgba(196,16,64,0.1)"
                    : "rgba(255,255,255,0.03)",
                  border: selected
                    ? "1px solid rgba(196,16,64,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {selected && <Check size={12} />}
                {brand}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* In Stock Only */}
      <div
        className="flex items-center justify-between rounded-xl cursor-pointer transition-all"
        style={{
          padding: scr.mobile ? "10px 12px" : "10px 14px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
        onClick={() => update({ inStockOnly: !filters.inStockOnly })}
        role="switch"
        aria-checked={filters.inStockOnly}
      >
        <span
          className="text-white font-semibold"
          style={{ fontSize: scr.mobile ? 12 : 13 }}
        >
          {t("store2.inStockOnly")}
        </span>
        <div
          className="relative rounded-full transition-all duration-300"
          style={{
            width: 38,
            height: 22,
            background: filters.inStockOnly
              ? "rgba(196,16,64,0.8)"
              : "rgba(255,255,255,0.1)",
          }}
        >
          <div
            className="absolute top-[2px] rounded-full bg-white transition-all duration-300"
            style={{
              width: 18,
              height: 18,
              insetInlineStart: filters.inStockOnly ? 18 : 2,
            }}
          />
        </div>
      </div>

      {/* Clear Filters */}
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="w-full flex items-center justify-center gap-1.5 text-brand font-bold cursor-pointer rounded-xl transition-all hover:bg-brand/5"
          style={{
            fontSize: scr.mobile ? 12 : 13,
            padding: scr.mobile ? "10px 0" : "10px 0",
            border: "1px solid rgba(196,16,64,0.2)",
            marginTop: 4,
          }}
        >
          <X size={14} />
          {t("store2.clearFilters")}
        </button>
      )}
    </div>
  );

  // Mobile: slide-in panel
  if (scr.mobile) {
    return (
      <>
        {/* Filter trigger button */}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 cursor-pointer transition-all font-bold rounded-xl relative"
          style={{
            fontSize: 12,
            padding: "8px 14px",
            background:
              activeCount > 0
                ? "rgba(196,16,64,0.1)"
                : "rgba(255,255,255,0.04)",
            border:
              activeCount > 0
                ? "1px solid rgba(196,16,64,0.3)"
                : "1px solid rgba(255,255,255,0.06)",
            color: activeCount > 0 ? "#c41040" : "#a1a1aa",
          }}
        >
          <SlidersHorizontal size={14} />
          {t("store2.filters")}
          {activeCount > 0 && (
            <span
              className="flex items-center justify-center rounded-full text-white font-black"
              style={{
                width: 18,
                height: 18,
                fontSize: 9,
                background: "#c41040",
                marginInlineStart: 4,
              }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-[60]"
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            onClick={() => setOpen(false)}
          />
        )}

        {/* Slide-in panel */}
        <div
          ref={panelRef}
          className="fixed top-0 z-[70] h-full transition-transform duration-300 ease-out"
          style={{
            insetInlineEnd: 0,
            width: "min(320px, 85vw)",
            background: "#111114",
            borderInlineStart: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
            transform: open ? "translateX(0)" : "translateX(100%)",
            overflowY: "auto",
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between sticky top-0 z-10"
            style={{
              padding: "14px 16px",
              background: "#111114",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span className="text-white font-extrabold" style={{ fontSize: 15 }}>
              {t("store2.filters")}
              {activeCount > 0 && (
                <span
                  className="text-brand font-normal"
                  style={{ fontSize: 12, marginInlineStart: 6 }}
                >
                  ({activeCount})
                </span>
              )}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="glass-icon-btn"
              style={{ width: 34, height: 34 }}
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>

          {/* Panel content */}
          <div style={{ padding: "12px 14px 80px" }}>{filterContent}</div>
        </div>
      </>
    );
  }

  // Desktop: inline collapsible
  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 cursor-pointer transition-all font-bold rounded-xl"
        style={{
          fontSize: 13,
          padding: "9px 16px",
          background:
            activeCount > 0
              ? "rgba(196,16,64,0.1)"
              : "rgba(255,255,255,0.04)",
          border:
            activeCount > 0
              ? "1px solid rgba(196,16,64,0.3)"
              : "1px solid rgba(255,255,255,0.06)",
          color: activeCount > 0 ? "#c41040" : "#a1a1aa",
        }}
      >
        <SlidersHorizontal size={15} />
        {t("store2.filters")}
        {activeCount > 0 && (
          <span
            className="flex items-center justify-center rounded-full text-white font-black"
            style={{
              width: 20,
              height: 20,
              fontSize: 10,
              background: "#c41040",
              marginInlineStart: 4,
            }}
          >
            {activeCount}
          </span>
        )}
        {open ? (
          <ChevronUp size={14} className="ms-auto" />
        ) : (
          <ChevronDown size={14} className="ms-auto" />
        )}
      </button>

      {open && (
        <div
          className="mt-2 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "14px 16px",
          }}
        >
          {filterContent}
        </div>
      )}
    </div>
  );
}

/* ── Collapsible section wrapper ── */
function FilterSection({
  title,
  expanded,
  onToggle,
  scr,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  scr: { mobile: boolean };
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between cursor-pointer transition-colors hover:bg-white/[0.02]"
        style={{ padding: scr.mobile ? "10px 12px" : "10px 14px" }}
      >
        <span
          className="text-white font-semibold"
          style={{ fontSize: scr.mobile ? 12 : 13 }}
        >
          {title}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-muted" />
        ) : (
          <ChevronDown size={14} className="text-muted" />
        )}
      </button>
      {expanded && (
        <div
          className="animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            padding: scr.mobile ? "0 12px 12px" : "0 14px 14px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Price input ── */
function PriceInput({
  placeholder,
  value,
  onChange,
  scr,
}: {
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
  scr: { mobile: boolean };
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : parseInt(v));
      }}
      className="flex-1 bg-transparent text-white outline-none rounded-lg transition-colors placeholder:text-[#52525b] focus:border-brand/30"
      style={{
        fontSize: scr.mobile ? 12 : 13,
        padding: scr.mobile ? "7px 10px" : "7px 12px",
        border: "1px solid rgba(255,255,255,0.08)",
        minWidth: 0,
      }}
    />
  );
}
