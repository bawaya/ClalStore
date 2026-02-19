"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/store", label: "المتجر" },
  { href: "/#plans", label: "الباقات" },
  { href: "/about", label: "من نحن" },
  { href: "/faq", label: "أسئلة شائعة" },
  { href: "/contact", label: "تواصل معنا" },
];

export function StoreHeader({ showBack }: { showBack?: boolean }) {
  const scr = useScreen();
  const itemCount = useCart((s) => s.getItemCount());
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-surface-card border-b border-surface-border sticky top-0 z-50">
      <div
        className="max-w-[1200px] mx-auto flex items-center justify-between"
        style={{ padding: scr.mobile ? "10px 14px" : "14px 28px" }}
      >
        {/* Right: Menu + Back + Logo Icon */}
        <div className="flex items-center gap-2">
          {scr.mobile && (
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-white bg-transparent border-0 cursor-pointer text-xl">☰</button>
          )}
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

        {/* Desktop Nav Links */}
        {scr.desktop && (
          <div className="flex items-center gap-4">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="text-white font-bold text-sm hover:text-brand transition-colors">{l.label}</Link>
            ))}
          </div>
        )}

        {/* Center (mobile only): Name */}
        {scr.mobile && (
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
        )}

        {/* Left: Cart */}
        <Link
          href="/store/cart"
          className="relative flex items-center justify-center rounded-xl cursor-pointer transition-transform active:scale-95"
          style={{
            width: scr.mobile ? 40 : 46,
            height: scr.mobile ? 40 : 46,
            fontSize: scr.mobile ? 18 : 20,
            background: itemCount > 0 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'rgba(5,150,105,0.12)',
            border: itemCount > 0 ? 'none' : '1px solid rgba(16,185,129,0.35)',
            boxShadow: itemCount > 0 ? '0 2px 10px rgba(16,185,129,0.4)' : 'none',
          }}
        >
          🛒
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 rounded-full font-black flex items-center justify-center"
              style={{
                width: scr.mobile ? 20 : 22, height: scr.mobile ? 20 : 22,
                fontSize: scr.mobile ? 10 : 11,
                background: '#fff',
                color: '#059669',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }}>
              {itemCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile dropdown nav */}
      {scr.mobile && menuOpen && (
        <div className="bg-surface-card border-t border-surface-border px-4 py-3 space-y-2">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className="block text-right text-white font-bold text-sm py-1.5 hover:text-brand">{l.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}
