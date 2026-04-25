// =====================================================
// ClalMobile — CompareBar (floating bottom bar)
// Shows selected products for comparison
// =====================================================

"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCompare, hydrateCompareStore } from "@/lib/store/compare";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export function CompareBar() {
  const scr = useScreen();
  const { t } = useLang();
  const { items, removeItem, clearAll } = useCompare();

  // Hydrate from localStorage on mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    hydrateCompareStore();
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[999] border-t shadow-2xl"
      dir="rtl"
      style={{
        bottom: scr.mobile ? 0 : 0,
        background: "linear-gradient(180deg, #17171b 0%, #111115 100%)",
        borderColor: "rgba(255,51,81,0.22)",
        boxShadow: "0 -18px 36px rgba(0,0,0,0.38)",
        paddingBottom: scr.mobile ? "env(safe-area-inset-bottom, 0px)" : 0,
      }}
    >
      <div
        className="max-w-[1200px] mx-auto"
        style={{ padding: scr.mobile ? "8px 12px" : "10px 24px" }}
      >
        <div
          className={`flex ${
            scr.mobile && items.length >= 3
              ? "flex-col gap-2"
              : "items-center justify-between gap-3"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative flex-shrink-0 overflow-hidden rounded-[16px] border border-[#30303a] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_58%),#141419]"
                style={{
                  width: scr.mobile ? 42 : 56,
                  height: scr.mobile ? 42 : 56,
                }}
              >
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name_he || item.name_ar}
                    fill
                    className="object-contain p-1.5"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg text-[#8f8f99]">
                    📱
                  </span>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#6a2232] bg-[#2a1016] text-[8px] text-[#ff8da0]"
                  aria-label="إزالة من المقارنة"
                >
                  ✕
                </button>
              </div>
            ))}
            <span
              className="flex-shrink-0 text-sm font-bold text-[#b8b8c2]"
              style={{ fontSize: scr.mobile ? 11 : 13 }}
            >
              {items.length}/4
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={clearAll}
              className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-4 text-xs font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
            >
              {t("compare.clearAll")}
            </button>
            <Link
              href="/store/compare"
              className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-xs font-extrabold text-white no-underline transition-colors hover:bg-[#df0d2f]"
            >
              {t("compare.compare")} ({items.length})
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
