"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

// RTL-aware breadcrumbs with schema.org BreadcrumbList JSON-LD for SEO.
// Items render right-to-left (first = rightmost). The last item is the current
// page (no link, white text). Separators use a small ChevronLeft (points
// "backwards" in RTL = visually toward the previous crumb on the right).
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    <nav
      aria-label="مسار التنقل"
      className="text-[12px] text-white/55"
      dir="rtl"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
              {idx > 0 && (
                <ChevronLeft
                  size={12}
                  strokeWidth={1.6}
                  className="text-white/25"
                  aria-hidden
                />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-white/55 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-white" : "text-white/55"}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
