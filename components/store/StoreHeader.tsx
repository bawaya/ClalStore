"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Menu, Search, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { useLang } from "@/lib/i18n";

const CATEGORY_PATHS = new Set([
  "/store",
  "/store/tvs",
  "/store/computers",
  "/store/tablets",
  "/store/smart-home",
  "/store/network",
]);

export function StoreHeader({ showBack }: { showBack?: boolean }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const itemCount = useCart((s) => s.getItemCount());
  const wishlistCount = useWishlist((s) => s.getCount());
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [custName, setCustName] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("clal_customer");
      if (!raw) return;
      const customer = JSON.parse(raw);
      if (customer?.name) setCustName(customer.name);
    } catch {}
  }, []);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const topStripItems =
    lang === "he"
      ? ["משלוח מהיר", "אחריות רשמית", "תשלומים ברורים"]
      : ["شحن سريع", "ضمان رسمي", "تقسيط واضح"];

  const storeNav = [
    {
      href: "/store",
      label: lang === "he" ? "סמארטפונים" : "الهواتف",
      active:
        pathname === "/store" ||
        pathname.startsWith("/store/product/") ||
        pathname === "/store/wishlist" ||
        pathname === "/store/compare",
    },
    {
      href: "/store/tablets",
      label: lang === "he" ? "טאבלטים" : "الأجهزة اللوحية",
      active: pathname === "/store/tablets",
    },
    {
      href: "/store/computers",
      label: lang === "he" ? "מחשבים" : "الحواسيب",
      active: pathname === "/store/computers",
    },
    {
      href: "/store/tvs",
      label: lang === "he" ? "טלוויזיות" : "التلفزيونات",
      active: pathname === "/store/tvs",
    },
    {
      href: "/store/smart-home",
      label: lang === "he" ? "בית חכם" : "المنزل الذكي",
      active: pathname === "/store/smart-home",
    },
    {
      href: "/store/network",
      label: lang === "he" ? "רשת" : "الشبكات",
      active: pathname === "/store/network",
    },
    {
      href: "/#plans",
      label: lang === "he" ? "חבילות" : "الباقات",
      active: false,
    },
    {
      href: "/deals",
      label: lang === "he" ? "מבצעים" : "العروض",
      active: pathname === "/deals",
    },
  ];

  const navLinks = [
    { href: "/", label: t("nav.home") },
    ...storeNav.map(({ href, label }) => ({ href, label })),
    {
      href: "/store/track",
      label: lang === "he" ? "מעקב הזמנה" : "تتبع الطلب",
    },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  const utilityLinks = [
    {
      href: custName ? "/store/account" : "/store/auth",
      label: custName || (lang === "he" ? "החשבון שלי" : "حسابي"),
      icon: User,
      count: null as number | null,
      active: pathname === "/store/account" || pathname === "/store/auth",
    },
    {
      href: "/store/wishlist",
      label: lang === "he" ? "מועדפים" : "المفضلة",
      icon: Heart,
      count: wishlistCount > 0 ? wishlistCount : null,
      active: pathname === "/store/wishlist",
    },
    {
      href: "/store/cart",
      label: lang === "he" ? "הסל שלי" : "السلة",
      icon: ShoppingCart,
      count: itemCount > 0 ? itemCount : null,
      active:
        pathname === "/store/cart" ||
        pathname.startsWith("/store/checkout/"),
    },
  ];

  const searchTarget = CATEGORY_PATHS.has(pathname) ? pathname : "/store";

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = query.trim();
    router.push(
      value ? `${searchTarget}?q=${encodeURIComponent(value)}` : searchTarget
    );
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#26262e] bg-[#111114]/95 text-white backdrop-blur-xl">
      <div className="border-t-2 border-[#ff0e34] bg-[#070709]">
        <div className="mx-auto flex max-w-[1540px] items-center justify-center gap-4 px-4 py-2 text-[11px] text-[#f4f4f5] md:text-xs">
          {topStripItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1540px] px-4 md:px-6">
        <div className="grid gap-4 border-b border-[#23232b] py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-center justify-between gap-3 lg:justify-start">
            <div className="flex items-center gap-2">
              {scr.mobile && (
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label={lang === "he" ? "תפריט" : "القائمة"}
                  aria-expanded={menuOpen}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#353540] bg-[#17171b]"
                >
                  <Menu size={18} />
                </button>
              )}
              {showBack && (
                <Link
                  href="/store"
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#353540] bg-[#17171b] px-3 text-sm font-semibold text-[#d9d9df] transition-colors hover:border-[#ff3351]/40 hover:text-white"
                >
                  {lang === "he" ? "חזרה לחנות" : "العودة للمتجر"}
                </Link>
              )}
            </div>

            <Link href="/store" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#34343d] bg-[#17171b]">
                <Logo size={scr.mobile ? 28 : 30} />
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-base font-black tracking-[0.02em]">
                  <span className="text-[#ff3351]">Clal</span>Mobile
                </div>
                <div className="text-[11px] text-[#9d9daa]">
                  {t("store.hotAgent")}
                </div>
              </div>
            </Link>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="order-3 flex items-center gap-2 lg:order-2"
            role="search"
          >
            <label className="relative flex min-h-[52px] flex-1 items-center overflow-hidden rounded-full border border-[#53535e] bg-white/[0.03]">
              <Search size={18} className="absolute right-4 text-[#d5d5dd]" />
              <input
                className="h-full w-full bg-transparent px-4 pr-11 text-sm text-white outline-none placeholder:text-[#9c9ca8]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  lang === "he"
                    ? "חיפוש מכשיר, צבע, נפח או מותג"
                    : "ابحث عن جهاز، لون، سعة، أو علامة"
                }
              />
            </label>
            <button
              type="submit"
              className="hidden min-h-[52px] rounded-full border border-[#ff0e34] px-5 text-sm font-bold text-[#ff4c67] transition-colors hover:bg-[#ff0e34]/10 lg:inline-flex lg:items-center"
            >
              {lang === "he" ? "חיפוש" : "بحث"}
            </button>
          </form>

          <div className="order-2 flex items-center justify-end gap-2 lg:order-3">
            <div className="hidden lg:block">
              <LangSwitcher size="sm" />
            </div>

            {utilityLinks.map(({ href, label, icon: Icon, count, active }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={`relative inline-flex h-11 items-center justify-center rounded-2xl border px-3 transition-colors ${
                  active
                    ? "border-[#ff3351]/50 bg-[#ff3351]/10 text-white"
                    : "border-[#34343d] bg-[#17171b] text-[#d6d6dd] hover:border-[#ff3351]/35 hover:text-white"
                } ${scr.mobile ? "w-11" : "min-w-[48px]"}`}
              >
                <Icon size={18} />
                {count && (
                  <span className="absolute -top-1 -left-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#ff0e34] px-1 text-[10px] font-black text-white">
                    {count}
                  </span>
                )}
              </Link>
            ))}

            {scr.mobile && <LangSwitcher size="sm" />}
          </div>
        </div>

        <nav className="hidden items-center justify-center gap-7 overflow-x-auto py-4 text-sm lg:flex">
          {storeNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative whitespace-nowrap pb-2 font-semibold transition-colors ${
                link.active ? "text-white" : "text-[#d3d3da] hover:text-white"
              }`}
            >
              {link.label}
              {link.active && (
                <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#ff3351]" />
              )}
            </Link>
          ))}
        </nav>
      </div>

      {scr.mobile && menuOpen && (
        <div className="border-t border-[#23232b] bg-[#15151a] px-4 py-4">
          <nav className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl border border-[#2e2e37] bg-[#1b1b22] px-4 py-3 text-sm font-semibold text-[#f3f3f5]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
