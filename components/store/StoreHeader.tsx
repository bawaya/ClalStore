"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { useLang } from "@/lib/i18n";
import { Menu, X, ArrowRight, User, Heart, ShoppingCart } from "lucide-react";

export function StoreHeader({ showBack }: { showBack?: boolean }) {
  const scr = useScreen();
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());
  const wishlistCount = useWishlist((s) => s.getCount());
  const [menuOpen, setMenuOpen] = useState(false);

  const [custName, setCustName] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("clal_customer");
      if (raw) {
        const c = JSON.parse(raw);
        if (c?.name) setCustName(c.name);
      }
    } catch {}
  }, []);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/store", label: t("nav.store") },
    { href: "/#plans", label: t("nav.plans") },
    { href: "/about", label: t("nav.about") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  const inWishlist = wishlistCount > 0;

  return (
    <header className="glass-header glass-glow-line sticky top-0 z-50">
      <div
        className="max-w-[1200px] mx-auto flex items-center justify-between"
        style={{ padding: scr.mobile ? "8px 14px" : "14px 28px" }}
      >
        {/* Right side: Menu + Back + Logo */}
        <div className="flex items-center gap-2">
          {scr.mobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="glass-icon-btn"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen}
              aria-controls="store-mobile-nav"
              style={{ width: 36, height: 36 }}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          {showBack && (
            <Link
              href="/store"
              className="glass-icon-btn"
              style={{ width: scr.mobile ? 30 : 36, height: scr.mobile ? 30 : 36 }}
            >
              <ArrowRight size={16} />
            </Link>
          )}
          <Link href="/store">
            <Logo size={scr.mobile ? 28 : 34} />
          </Link>
        </div>

        {/* Desktop nav links */}
        {scr.desktop && (
          <div className="flex items-center gap-4">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-white font-bold text-sm hover:text-brand transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <LangSwitcher size="sm" />
          </div>
        )}

        {/* Center (mobile): Brand name */}
        {scr.mobile && (
          <Link href="/store" className="text-center">
            <div className="font-black" style={{ fontSize: 15, lineHeight: 1.2 }}>
              <span className="text-brand">Clal</span>Mobile
            </div>
            <div className="text-muted" style={{ fontSize: 7 }}>
              {t("store.hotAgent")}
            </div>
          </Link>
        )}

        {/* Left side: Account + Wishlist + Cart (desktop only cart in header) */}
        <div className="flex items-center gap-1.5">
          <Link
            href={custName ? "/store/account" : "/store/auth"}
            className={`glass-icon-btn ${custName ? "glass-icon-btn-active" : ""}`}
            title={custName || t("nav.login")}
            style={{
              width: scr.mobile ? 34 : 42,
              height: scr.mobile ? 34 : 42,
            }}
          >
            <User size={scr.mobile ? 15 : 18} />
          </Link>

          <Link
            href="/store/wishlist"
            className={`glass-icon-btn relative ${inWishlist ? "glass-icon-btn-active" : ""}`}
            style={{
              width: scr.mobile ? 34 : 42,
              height: scr.mobile ? 34 : 42,
            }}
          >
            <Heart
              size={scr.mobile ? 15 : 18}
              fill={inWishlist ? "currentColor" : "none"}
            />
            {inWishlist && (
              <span
                className="absolute -top-1.5 rounded-full font-black flex items-center justify-center"
                style={{
                  insetInlineEnd: -6,
                  width: 18,
                  height: 18,
                  fontSize: 9,
                  background: "#c41040",
                  color: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart icon — always visible on desktop, hidden on mobile (replaced by StickyCartBar) */}
          {!scr.mobile && (
            <Link
              href="/store/cart"
              className={`glass-icon-btn relative ${itemCount > 0 ? "glass-icon-btn-active" : ""}`}
              style={{ width: 46, height: 46 }}
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span
                  className="absolute -top-1.5 rounded-full font-black flex items-center justify-center"
                  style={{
                    insetInlineEnd: -6,
                    width: 22,
                    height: 22,
                    fontSize: 11,
                    background: "linear-gradient(135deg, #c41040, #ff3366)",
                    color: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }}
                >
                  {itemCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile dropdown nav — includes LangSwitcher */}
      {scr.mobile && menuOpen && (
        <div
          id="store-mobile-nav"
          className="glass-card-static px-4 py-3 animate-fade-in"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="space-y-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block text-right text-white font-bold text-sm py-2 px-2 rounded-lg hover:bg-glass-hover hover:text-brand transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-xs text-muted">{t("common.close")}</span>
            <LangSwitcher size="sm" />
          </div>
        </div>
      )}
    </header>
  );
}
