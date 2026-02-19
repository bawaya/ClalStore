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
          className="relative flex items-center justify-center rounded-xl cursor-pointer transition-transform active:scale-95"
          style={{
            width: scr.mobile ? 40 : 46,
            height: scr.mobile ? 40 : 46,
            fontSize: scr.mobile ? 18 : 20,
            background: itemCount > 0 ? 'linear-gradient(135deg, #c41040 0%, #ff4060 100%)' : 'rgba(196,16,64,0.12)',
            border: itemCount > 0 ? 'none' : '1px solid rgba(196,16,64,0.3)',
          }}
        >
          🛒
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 rounded-full bg-white text-brand font-black flex items-center justify-center shadow-md"
              style={{ width: scr.mobile ? 20 : 22, height: scr.mobile ? 20 : 22, fontSize: scr.mobile ? 10 : 11 }}>
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
