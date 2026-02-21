// =====================================================
// ClalMobile — CompareBar (floating bottom bar)
// Shows selected products for comparison
// =====================================================

"use client";

import Link from "next/link";
import { useCompare } from "@/lib/store/compare";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export function CompareBar() {
  const scr = useScreen();
  const { t } = useLang();
  const { items, removeItem, clearAll } = useCompare();

  if (items.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[999] border-t shadow-2xl"
      dir="rtl"
      style={{
        bottom: scr.mobile ? 0 : 0,
        background: "#18181b",
        borderColor: "rgba(196,16,64,0.4)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
        paddingBottom: scr.mobile ? "env(safe-area-inset-bottom, 0px)" : 0,
      }}
    >
      <div
        className="max-w-[1200px] mx-auto flex items-center justify-between gap-2"
        style={{ padding: scr.mobile ? "8px 12px" : "10px 24px" }}
      >
        {/* Right: Thumbnails */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex-shrink-0 bg-[#1a1a1e] rounded-lg border border-surface-border overflow-hidden"
              style={{
                width: scr.mobile ? 44 : 52,
                height: scr.mobile ? 44 : 52,
              }}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name_ar}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-lg opacity-30">📱</span>
              )}
              <button
                onClick={() => removeItem(item.id)}
                className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-red-600 text-white border-0 cursor-pointer flex items-center justify-center"
                style={{ fontSize: 8, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
          <span
            className="text-muted font-bold flex-shrink-0"
            style={{ fontSize: scr.mobile ? 11 : 13 }}
          >
            {items.length}/4
          </span>
        </div>

        {/* Left: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={clearAll}
            className="border border-surface-border bg-transparent text-muted rounded-lg cursor-pointer font-bold transition-colors hover:text-white"
            style={{
              fontSize: scr.mobile ? 10 : 12,
              padding: scr.mobile ? "5px 10px" : "6px 14px",
            }}
          >
            {t("compare.clearAll")}
          </button>
          <Link
            href="/store/compare"
            className="rounded-lg font-extrabold cursor-pointer transition-all text-white no-underline"
            style={{
              background: "#c41040",
              fontSize: scr.mobile ? 11 : 13,
              padding: scr.mobile ? "6px 14px" : "8px 20px",
            }}
          >
            {t("compare.compare")} ({items.length})
          </Link>
        </div>
      </div>
    </div>
  );
}
