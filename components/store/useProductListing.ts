"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/types/database";
import type { SortKey } from "./SortDropdown";

const DEFAULT_PAGE_SIZE = 24;

function discountPct(p: Product): number {
  if (!p.old_price || p.old_price <= p.price) return 0;
  return Math.round(((p.old_price - p.price) / p.old_price) * 100);
}

function sortProducts(list: Product[], sortBy: SortKey): Product[] {
  if (sortBy === "default") return list;

  const sorted = [...list];
  switch (sortBy) {
    case "price-asc":
      return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    case "price-desc":
      return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    case "newest":
      // sort_position lower = featured first; fall back to created_at desc
      return sorted.sort((a, b) => {
        const aPos = a.sort_position ?? Number.MAX_SAFE_INTEGER;
        const bPos = b.sort_position ?? Number.MAX_SAFE_INTEGER;
        if (aPos !== bPos) return aPos - bPos;
        const aDate = (a as unknown as { created_at?: string }).created_at || "";
        const bDate = (b as unknown as { created_at?: string }).created_at || "";
        return bDate.localeCompare(aDate);
      });
    case "best-selling":
      return sorted.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    case "discount":
      return sorted.sort((a, b) => discountPct(b) - discountPct(a));
    default:
      return sorted;
  }
}

// Shared sort + "Load more" pagination logic for store listings.
// Initial page = pageSize products. Each loadMore() adds another pageSize.
// When the underlying filtered list or sortBy changes, pagination resets.
export function useProductListing(
  filtered: Product[],
  pageSize: number = DEFAULT_PAGE_SIZE
) {
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const sorted = useMemo(() => sortProducts(filtered, sortBy), [filtered, sortBy]);

  // Reset pagination whenever the dataset shape changes (filter or sort change).
  // We key off length + sortBy to avoid resetting on object identity churn.
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filtered.length, sortBy, pageSize]);

  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;
  const remaining = Math.max(0, sorted.length - visibleCount);
  const loadMore = () => setVisibleCount((n) => n + pageSize);

  return {
    sortBy,
    setSortBy,
    visible,
    sortedTotal: sorted.length,
    hasMore,
    remaining,
    loadMore,
  };
}
