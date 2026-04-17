"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, Clock, Loader2, ArrowUpLeft, Tag, Layers } from "lucide-react";
import { useScreen, useDebounce, useLocalStorage } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

interface AutocompleteProduct {
  id: string;
  name_ar: string;
  name_he?: string;
  name_en?: string;
  brand: string;
  price: number;
  image_url?: string;
}

interface AutocompleteCategory {
  id: string;
  name_ar: string;
  name_he: string;
}

interface AutocompleteResult {
  products: AutocompleteProduct[];
  brands: string[];
  categories: AutocompleteCategory[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBrandSelect?: (brand: string) => void;
  onSubmit?: (query: string) => void;
}

const MAX_RECENT = 5;

export function SmartSearchBar({ value, onChange, onBrandSelect, onSubmit }: Props) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<AutocompleteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>(
    "clal_recent_searches",
    []
  );

  const debouncedQuery = useDebounce(value, 300);

  const showDropdown = focused && (
    value.length > 0 ||
    (value.length === 0 && recentSearches.length > 0)
  );

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/store/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=5`)
      .then((r) => r.json())
      .then((json: any) => {
        if (!cancelled) {
          const data: AutocompleteResult = json.data ?? json;
          setResults(data);
          setActiveIdx(-1);
        }
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const flatItems = useCallback(() => {
    if (!results && value.length === 0) {
      return recentSearches.map((s) => ({ type: "recent" as const, label: s }));
    }
    if (!results) return [];

    const items: { type: string; label: string; data?: unknown }[] = [];
    results.brands.forEach((b) =>
      items.push({ type: "brand", label: b })
    );
    results.categories.forEach((c) =>
      items.push({
        type: "category",
        label: lang === "he" ? c.name_he : c.name_ar,
        data: c,
      })
    );
    results.products.forEach((p) =>
      items.push({
        type: "product",
        label: lang === "he" ? (p.name_he || p.name_ar) : p.name_ar,
        data: p,
      })
    );
    if (value.trim()) {
      items.push({ type: "search", label: value.trim() });
    }
    return items;
  }, [results, value, recentSearches, lang]);

  const saveRecent = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      setRecentSearches((prev) => {
        const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT);
        return next;
      });
    },
    [setRecentSearches]
  );

  const handleSelect = useCallback(
    (item: ReturnType<typeof flatItems>[number]) => {
      switch (item.type) {
        case "product": {
          const p = item.data as AutocompleteProduct;
          saveRecent(item.label);
          router.push(`/store/product/${p.id}`);
          break;
        }
        case "brand":
          saveRecent(item.label);
          onBrandSelect?.(item.label);
          break;
        case "category":
          saveRecent(item.label);
          onChange(item.label);
          onSubmit?.(item.label);
          break;
        case "recent":
          onChange(item.label);
          onSubmit?.(item.label);
          break;
        case "search":
          saveRecent(item.label);
          onSubmit?.(item.label);
          break;
      }
      setFocused(false);
      inputRef.current?.blur();
    },
    [onChange, onBrandSelect, onSubmit, router, saveRecent]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const items = flatItems();
    if (!showDropdown || items.length === 0) {
      if (e.key === "Enter") {
        saveRecent(value);
        onSubmit?.(value);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((prev) => (prev + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((prev) => (prev - 1 + items.length) % items.length);
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < items.length) {
          handleSelect(items[activeIdx]);
        } else {
          saveRecent(value);
          onSubmit?.(value);
          setFocused(false);
        }
        break;
      case "Escape":
        setFocused(false);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearRecent = () => setRecentSearches([]);

  const getName = (p: AutocompleteProduct) =>
    lang === "he" ? (p.name_he || p.name_ar) : p.name_ar;

  const items = flatItems();
  const listboxOpen = showDropdown && items.length > 0;

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div
        className={`flex items-center gap-2 rounded-xl transition-all duration-300 ${
          focused
            ? "ring-1 ring-brand/40 shadow-[0_0_20px_rgba(196,16,64,0.1)]"
            : ""
        }`}
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: focused
            ? "1px solid rgba(196,16,64,0.25)"
            : "1px solid rgba(255,255,255,0.06)",
          padding: scr.mobile ? "8px 12px" : "10px 16px",
        }}
      >
        {loading ? (
          <Loader2
            size={scr.mobile ? 14 : 16}
            className="text-brand animate-spin flex-shrink-0"
          />
        ) : (
          <Search
            size={scr.mobile ? 14 : 16}
            className="text-muted flex-shrink-0"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className="flex-1 bg-transparent border-none text-white outline-none placeholder:text-[#52525b]"
          style={{ fontSize: scr.mobile ? 13 : 14 }}
          placeholder={t("store2.searchPlaceholder")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          aria-label={t("store.search")}
          aria-autocomplete="list"
          aria-expanded={listboxOpen}
          aria-controls={listboxOpen ? listboxId : undefined}
          aria-haspopup="listbox"
          autoComplete="off"
        />
        {value && (
          <button
            onClick={() => {
              onChange("");
              setResults(null);
              inputRef.current?.focus();
            }}
            className="text-muted hover:text-white transition-colors cursor-pointer p-0.5"
            aria-label={t("store2.clearSearch")}
          >
            <X size={scr.mobile ? 14 : 16} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && items.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          className="absolute z-50 w-full mt-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            background: "rgba(17,17,20,0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)",
            maxHeight: scr.mobile ? 320 : 400,
            overflowY: "auto",
          }}
          role="listbox"
        >
          {/* Recent searches header */}
          {value.length === 0 && recentSearches.length > 0 && (
            <div
              className="flex items-center justify-between px-3 pt-2.5 pb-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span className="text-[11px] text-muted font-semibold">
                {t("store2.recentSearches")}
              </span>
              <button
                onClick={clearRecent}
                className="text-[10px] text-brand hover:text-white transition-colors cursor-pointer"
              >
                {t("store2.clearRecent")}
              </button>
            </div>
          )}

          {/* Brand suggestions */}
          {results?.brands.map((brand, _i) => {
            const idx = items.findIndex(
              (it) => it.type === "brand" && it.label === brand
            );
            return (
              <button
                key={`brand-${brand}`}
                onClick={() => handleSelect({ type: "brand", label: brand })}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center gap-2.5 px-3 cursor-pointer transition-colors ${
                  activeIdx === idx
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]"
                }`}
                style={{ padding: scr.mobile ? "8px 12px" : "9px 14px" }}
                role="option"
                aria-selected={activeIdx === idx}
              >
                <div
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{
                    width: scr.mobile ? 30 : 34,
                    height: scr.mobile ? 30 : 34,
                    background: "rgba(196,16,64,0.1)",
                  }}
                >
                  <Tag size={13} className="text-brand" />
                </div>
                <span
                  className="text-white font-bold flex-1 text-start"
                  style={{ fontSize: scr.mobile ? 12 : 13 }}
                >
                  {brand}
                </span>
                <span className="text-[10px] text-muted">
                  {t("store2.brandFilter")}
                </span>
              </button>
            );
          })}

          {/* Category suggestions */}
          {results?.categories.map((cat) => {
            const catLabel = lang === "he" ? cat.name_he : cat.name_ar;
            const idx = items.findIndex(
              (it) => it.type === "category" && it.label === catLabel
            );
            return (
              <button
                key={`cat-${cat.id}`}
                onClick={() =>
                  handleSelect({
                    type: "category",
                    label: catLabel,
                    data: cat,
                  })
                }
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center gap-2.5 cursor-pointer transition-colors ${
                  activeIdx === idx
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]"
                }`}
                style={{ padding: scr.mobile ? "8px 12px" : "9px 14px" }}
                role="option"
                aria-selected={activeIdx === idx}
              >
                <div
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{
                    width: scr.mobile ? 30 : 34,
                    height: scr.mobile ? 30 : 34,
                    background: "rgba(168,85,247,0.1)",
                  }}
                >
                  <Layers size={13} className="text-purple-400" />
                </div>
                <span
                  className="text-white font-semibold flex-1 text-start"
                  style={{ fontSize: scr.mobile ? 12 : 13 }}
                >
                  {catLabel}
                </span>
              </button>
            );
          })}

          {/* Divider between brands/cats and products */}
          {results &&
            (results.brands.length > 0 || results.categories.length > 0) &&
            results.products.length > 0 && (
              <div
                style={{
                  height: 1,
                  background: "rgba(255,255,255,0.04)",
                  margin: "2px 12px",
                }}
              />
            )}

          {/* Product suggestions */}
          {results?.products.map((p) => {
            const idx = items.findIndex(
              (it) => it.type === "product" && (it.data as AutocompleteProduct).id === p.id
            );
            return (
              <button
                key={`prod-${p.id}`}
                onClick={() =>
                  handleSelect({
                    type: "product",
                    label: getName(p),
                    data: p,
                  })
                }
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center gap-2.5 cursor-pointer transition-colors ${
                  activeIdx === idx
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]"
                }`}
                style={{ padding: scr.mobile ? "7px 12px" : "8px 14px" }}
                role="option"
                aria-selected={activeIdx === idx}
              >
                {/* Thumbnail */}
                <div
                  className="relative flex-shrink-0 rounded-lg overflow-hidden"
                  style={{
                    width: scr.mobile ? 36 : 42,
                    height: scr.mobile ? 36 : 42,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={getName(p)}
                      fill
                      sizes="42px"
                      className="object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <Search size={14} />
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0 text-start">
                  <div
                    className="text-white font-bold truncate"
                    style={{ fontSize: scr.mobile ? 12 : 13 }}
                    dir="ltr"
                  >
                    {getName(p)}
                  </div>
                  <div
                    className="text-muted truncate"
                    style={{ fontSize: scr.mobile ? 10 : 11 }}
                  >
                    {p.brand}
                  </div>
                </div>

                {/* Price */}
                <span
                  className="font-black flex-shrink-0"
                  style={{
                    color: "#c41040",
                    fontSize: scr.mobile ? 12 : 13,
                  }}
                >
                  ₪{p.price.toLocaleString()}
                </span>
              </button>
            );
          })}

          {/* Recent search items */}
          {value.length === 0 &&
            recentSearches.map((s, i) => (
              <button
                key={`recent-${i}`}
                onClick={() => handleSelect({ type: "recent", label: s })}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-2.5 cursor-pointer transition-colors ${
                  activeIdx === i
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]"
                }`}
                style={{ padding: scr.mobile ? "8px 12px" : "9px 14px" }}
                role="option"
                aria-selected={activeIdx === i}
              >
                <Clock size={13} className="text-muted flex-shrink-0" />
                <span
                  className="text-[#a1a1aa] font-medium flex-1 text-start"
                  style={{ fontSize: scr.mobile ? 12 : 13 }}
                >
                  {s}
                </span>
                <ArrowUpLeft size={12} className="text-muted" />
              </button>
            ))}

          {/* "Search for: ..." option */}
          {value.trim() && (
            <>
              <div
                style={{
                  height: 1,
                  background: "rgba(255,255,255,0.04)",
                  margin: "2px 12px",
                }}
              />
              <button
                onClick={() =>
                  handleSelect({ type: "search", label: value.trim() })
                }
                onMouseEnter={() => setActiveIdx(items.length - 1)}
                className={`w-full flex items-center gap-2.5 cursor-pointer transition-colors ${
                  activeIdx === items.length - 1
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04]"
                }`}
                style={{ padding: scr.mobile ? "8px 12px" : "9px 14px" }}
                role="option"
                aria-selected={activeIdx === items.length - 1}
              >
                <Search size={13} className="text-brand flex-shrink-0" />
                <span style={{ fontSize: scr.mobile ? 12 : 13 }}>
                  <span className="text-muted">
                    {t("store2.searchSuggestion")}:{" "}
                  </span>
                  <span className="text-white font-bold">{value.trim()}</span>
                </span>
              </button>
            </>
          )}

          {/* No results */}
          {value.trim() &&
            results &&
            results.products.length === 0 &&
            results.brands.length === 0 &&
            results.categories.length === 0 && (
              <div
                className="text-center text-muted py-6"
                style={{ fontSize: scr.mobile ? 11 : 12 }}
              >
                {t("store2.noResultsFor")} &quot;{value.trim()}&quot;
              </div>
            )}
        </div>
      )}
    </div>
  );
}
