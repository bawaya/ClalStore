"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { useLang } from "@/lib/i18n";
import { Menu, ArrowRight, User, Heart, ShoppingCart } from "lucide-react";

export function StoreHeader({ showBack }: { showBack?: boolean }) {
  const scr = useScreen();
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());
  const wishlistCount = useWishlist((s) => s.getCount());
  const [menuOpen, setMenuOpen] = useState(false);

  // Customer auth state
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
        style={{ padding: scr.mobile ? "10px 14px" : "14px 28px" }}
      >
        {/* Right: Menu + Back + Logo Icon */}
        <div className="flex items-center gap-2">
          {scr.mobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="glass-icon-btn"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen}
              aria-controls="store-mobile-nav"
            >
              <Menu size={20} />
            </button>
          )}
          {showBack && (
            <Link
              href="/store"
              className="glass-icon-btn"
              style={{
                width: scr.mobile ? 30 : 36,
                height: scr.mobile ? 30 : 36,
              }}
            >
              <ArrowRight size={16} />
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
            <LangSwitcher size="sm" />
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
              {t("store.hotAgent")}
            </div>
          </Link>
        )}

        {/* Left: LangSwitcher (mobile) + Account + Wishlist + Cart */}
        <div className="flex items-center gap-1.5">
          {scr.mobile && <LangSwitcher size="sm" />}

          {/* Account icon */}
          <Link
            href={custName ? "/store/account" : "/store/auth"}
            className={`glass-icon-btn ${custName ? "glass-icon-btn-active" : ""}`}
            title={custName || t("nav.login")}
            style={{
              width: scr.mobile ? 36 : 42,
              height: scr.mobile ? 36 : 42,
            }}
          >
            <User size={scr.mobile ? 16 : 18} />
          </Link>

          {/* Wishlist icon */}
          <Link
            href="/store/wishlist"
            className={`glass-icon-btn ${inWishlist ? "glass-icon-btn-active" : ""}`}
            style={{
              width: scr.mobile ? 36 : 42,
              height: scr.mobile ? 36 : 42,
            }}
          >
            <Heart
              size={scr.mobile ? 16 : 18}
              fill={inWishlist ? "currentColor" : "none"}
            />
            {inWishlist && (
              <span
                className="absolute -top-1.5 rounded-full font-black flex items-center justify-center"
                style={{
                  insetInlineEnd: -6,
                  width: scr.mobile ? 18 : 20,
                  height: scr.mobile ? 18 : 20,
                  fontSize: scr.mobile ? 9 : 10,
                  background: "#c41040",
                  color: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart icon */}
          <Link
            href="/store/cart"
            className={`glass-icon-btn ${itemCount > 0 ? "glass-icon-btn-active" : ""}`}
            style={{
              width: scr.mobile ? 40 : 46,
              height: scr.mobile ? 40 : 46,
            }}
          >
            <ShoppingCart size={scr.mobile ? 18 : 20} />
            {itemCount > 0 && (
              <span
                className="absolute -top-1.5 rounded-full font-black flex items-center justify-center"
                style={{
                  insetInlineEnd: -6,
                  width: scr.mobile ? 20 : 22,
                  height: scr.mobile ? 20 : 22,
                  fontSize: scr.mobile ? 10 : 11,
                  background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%)",
                  color: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile dropdown nav */}
      {scr.mobile && menuOpen && (
        <div id="store-mobile-nav" className="glass-card-static px-4 py-3 space-y-2">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className="block text-right text-white font-bold text-sm py-1.5 hover:text-brand">{l.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}
