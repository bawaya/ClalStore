"use client";

import Link from "next/link";

const brands = [
  { name: "Apple", slug: "apple" },
  { name: "Samsung", slug: "samsung" },
  { name: "Xiaomi", slug: "xiaomi" },
  { name: "Oppo", slug: "oppo" },
];

export default function BrandStrip() {
  return (
    <div className="py-5 px-6">
      <div
        className="flex flex-wrap justify-center items-center gap-x-9 gap-y-3 lg:flex-nowrap opacity-60 lg:opacity-[0.42] lg:hover:opacity-100 transition"
      >
        {brands.map((b) => (
          <Link
            key={b.slug}
            href={`/store?brand=${b.slug}`}
            className="text-[15px] text-white"
            aria-label={b.name}
          >
            {b.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
