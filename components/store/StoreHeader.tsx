"use client";

import Link from "next/link";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";

export function StoreHeader({ showBack }: { showBack?: boolean }) {
  const scr = useScreen();
  const itemCount = useCart((s) => s.getItemCount());

  return (
    <header className="bg-surface-card border-b border-surface-border sticky top-0 z-50">
      <div
        className="max-w-[1200px] mx-auto flex items-center justify-between"
        style={{ padding: scr.mobile ? "10px 14px" : "14px 28px" }}
      >
        {/* Right: Back + Logo Icon */}
        <div className="flex items-center gap-2">
          {showBack && (
            <Link
              href="/store"
              className="flex items-center justify-center rounded-[10px] border border-surface-border bg-transparent text-white cursor-pointer"
              style={{
                width: scr.mobile ? 30 : 36,
                height: scr.mobile ? 30 : 36,
                fontSize: 14,
              }}
            >
              →
            </Link>
          )}
          <Link href="/store">
            <Logo size={scr.mobile ? 28 : 34} />
          </Link>
        </div>

        {/* Center: Name */}
        <Link href="/store" className="text-center">
          <div
            className="font-black"
            style={{ fontSize: scr.mobile ? 14 : 18 }}
          >
            <span className="text-brand">Clal</span>Mobile
          </div>
          <div
            className="text-muted"
            style={{ fontSize: scr.mobile ? 7 : 9 }}
          >
            وكيل رسمي لـ HOT Mobile
          </div>
        </Link>

        {/* Left: Cart */}
        <Link
          href="/store/cart"
          className="relative flex items-center justify-center rounded-xl border border-surface-border bg-transparent cursor-pointer"
          style={{
            width: scr.mobile ? 36 : 44,
            height: scr.mobile ? 36 : 44,
            fontSize: scr.mobile ? 16 : 18,
          }}
        >
          🛒
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand text-white text-[8px] font-extrabold flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
