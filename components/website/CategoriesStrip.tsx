"use client";

import Link from "next/link";
import { Smartphone, Tablet, Laptop, Tv, Home, Headphones } from "lucide-react";

const categories = [
  { label: "الهواتف", href: "/store", Icon: Smartphone },
  { label: "تابلت / آيباد", href: "/store/tablets", Icon: Tablet },
  { label: "الحواسيب", href: "/store/computers", Icon: Laptop },
  { label: "التلفزيونات", href: "/store/tvs", Icon: Tv },
  { label: "المنزل الذكي", href: "/store/smart-home", Icon: Home },
  { label: "الإكسسوارات", href: "/store?type=accessory", Icon: Headphones },
];

export default function CategoriesStrip() {
  return (
    <div className="py-7 px-6">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 max-w-6xl mx-auto">
        {categories.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-[#0d0d0f] border border-white/[0.05] rounded-xl px-2 py-[18px] text-center hover:border-[#ff0e34] transition group"
          >
            <Icon
              size={22}
              strokeWidth={1.4}
              className="mx-auto mb-2 text-white/85 group-hover:text-white"
            />
            <div className="text-[11px] text-white/85 group-hover:text-white">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
