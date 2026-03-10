"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";

const NAV_ITEMS = [
  { key: "dashboard", href: "/admin", icon: "📊", label: "داشبورد" },
  { key: "products", href: "/admin/products", icon: "📱", label: "المنتجات" },
  { key: "coupons", href: "/admin/coupons", icon: "🏷️", label: "كوبونات" },
  { key: "heroes", href: "/admin/heroes", icon: "🖼️", label: "بنرات" },
  { key: "order", href: "/admin/order", icon: "📌", label: "ترتيب الأولوية" },
  { key: "deals", href: "/admin/deals", icon: "🔥", label: "العروض" },
  { key: "reviews", href: "/admin/reviews", icon: "⭐", label: "التقييمات" },
  { key: "lines", href: "/admin/lines", icon: "📡", label: "باقات" },
  { key: "push", href: "/admin/push", icon: "🔔", label: "إشعارات" },
  { key: "bot", href: "/admin/bot", icon: "🤖", label: "البوت" },
  { key: "homepage", href: "/admin/homepage", icon: "🏠", label: "الصفحة الرئيسية" },
  { key: "website", href: "/admin/website", icon: "🌐", label: "محتوى الموقع" },
  { key: "features", href: "/admin/features", icon: "🎛️", label: "الميزات" },
  { key: "settings", href: "/admin/settings", icon: "⚙️", label: "إعدادات" },
];

const QUICK_NAV = ["dashboard", "products", "deals", "settings"];
const MORE_NAV = NAV_ITEMS.filter((n) => !QUICK_NAV.includes(n.key));

export function AdminShell({ children }: { children: React.ReactNode }) {
  const scr = useScreen();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = NAV_ITEMS.find((n) => pathname === n.href || (n.href !== "/admin" && pathname.startsWith(n.href)))?.key || "dashboard";

  if (scr.mobile) {
    return (
      <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen pb-16">
        {/* Top bar */}
        <div className="bg-surface-card border-b border-surface-border px-3 py-2.5 flex items-center justify-between sticky top-0 z-50">
          <Link href="/admin" className="flex items-center gap-1.5">
            <Logo size={28} showText label="ClalMobile" />
          </Link>
          <span className="text-[10px] text-muted">لوحة الإدارة</span>
        </div>

        {/* Content */}
        <div className="p-3 bg-surface-bg min-h-[calc(100vh-44px)]">{children}</div>

        {/* More menu overlay */}
        {moreOpen && (
          <div className="fixed inset-0 z-[60]" onClick={() => setMoreOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute bottom-14 left-2 right-2 bg-surface-card border border-surface-border rounded-2xl p-3 grid grid-cols-4 gap-2" onClick={(e) => e.stopPropagation()}>
              {MORE_NAV.map((n) => (
                <Link
                  key={n.key}
                  href={n.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center py-2 rounded-xl transition-colors"
                  style={{ color: active === n.key ? "#c41040" : "#a1a1aa", background: active === n.key ? "rgba(196,16,64,0.08)" : "transparent" }}
                >
                  <span className="text-lg">{n.icon}</span>
                  <span className="text-[9px] font-bold mt-1">{n.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Bottom tabs - 4 quick items + more */}
        <nav className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border flex z-50">
          {QUICK_NAV.map((key) => {
            const n = NAV_ITEMS.find((i) => i.key === key)!;
            return (
              <Link
                key={n.key}
                href={n.href}
                className="flex-1 flex flex-col items-center py-2 transition-colors"
                style={{ color: active === n.key ? "#c41040" : "#71717a" }}
              >
                <span className="text-lg">{n.icon}</span>
                <span className="text-[9px] font-bold mt-0.5">{n.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex-1 flex flex-col items-center py-2 transition-colors bg-transparent border-0 cursor-pointer"
            style={{ color: moreOpen || MORE_NAV.some((n) => n.key === active) ? "#c41040" : "#71717a" }}
          >
            <span className="text-lg">☰</span>
            <span className="text-[9px] font-bold mt-0.5">المزيد</span>
          </button>
        </nav>
      </div>
    );
  }

  // Desktop: Sidebar
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen flex">
      <aside className="w-56 bg-surface-card border-l border-surface-border flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-surface-border">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo size={36} showText label="ClalMobile" subtitle="لوحة الإدارة" />
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm"
              style={{
                background: active === n.key ? "rgba(196,16,64,0.08)" : "transparent",
                color: active === n.key ? "#c41040" : "#a1a1aa",
                fontWeight: active === n.key ? 700 : 500,
              }}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-surface-border">
          <Link href="/store" className="flex items-center gap-2 text-muted text-xs hover:text-white transition-colors px-3 py-2">
            🛒 المتجر
          </Link>
          <Link href="/crm" className="flex items-center gap-2 text-muted text-xs hover:text-white transition-colors px-3 py-2">
            📊 CRM
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto bg-surface-bg">{children}</main>
    </div>
  );
}
