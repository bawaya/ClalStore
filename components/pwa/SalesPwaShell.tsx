"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Plus,
  BarChart3,
  Calculator,
  ActivitySquare,
  FileEdit,
  Bell,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  labelHe?: string;
  icon: typeof Home;
  showInBottomNav?: boolean;
};

const NAV: NavItem[] = [
  { href: "/sales-pwa", label: "الرئيسية", labelHe: "בית", icon: Home, showInBottomNav: true },
  { href: "/sales-pwa/new", label: "بيعة جديدة", labelHe: "חדש", icon: Plus, showInBottomNav: true },
  { href: "/sales-pwa/commissions", label: "العمولات", labelHe: "עמלות", icon: BarChart3, showInBottomNav: true },
  { href: "/sales-pwa/calculator", label: "حاسبة", labelHe: "מחשבון", icon: Calculator, showInBottomNav: true },
  { href: "/sales-pwa/activity", label: "النشاط", labelHe: "פעילות", icon: ActivitySquare, showInBottomNav: true },
  { href: "/sales-pwa/corrections", label: "طلبات التصحيح", labelHe: "תיקונים", icon: FileEdit },
  { href: "/sales-pwa/announcements", label: "الإعلانات", labelHe: "הודעות", icon: Bell },
  { href: "/sales-pwa/docs", label: "الوثائق", labelHe: "מסמכים", icon: FileText },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/sales-pwa") return pathname === "/sales-pwa";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SalesPwaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [employeeName, setEmployeeName] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/employee/announcements", { credentials: "same-origin" });
        if (!res.ok) return;
        const json: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (json && typeof json === "object" && "unreadCount" in json) {
          const n = (json as { unreadCount?: number }).unreadCount;
          if (typeof n === "number") setUnread(n);
        }
      } catch {
        /* offline or not signed in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/employee/me", { credentials: "same-origin" });
        if (!res.ok) return;
        const json: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        // apiSuccess wraps payload in { success, data }
        const data =
          json && typeof json === "object" && "data" in json
            ? (json as { data?: { name?: string; email?: string } }).data
            : (json as { name?: string; email?: string } | undefined);
        const display = data?.name || data?.email || "";
        if (display) setEmployeeName(display);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 p-2 md:hidden"
              aria-label="فتح القائمة"
              onClick={() => setDrawerOpen((v) => !v)}
            >
              {drawerOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
            <div className="flex items-baseline gap-2">
              <div className="text-base font-black tracking-tight md:text-lg">ClalMobile · مبيعات</div>
              <div className="hidden text-[10px] text-slate-400 md:block">PWA</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {employeeName && (
              <div className="hidden text-xs text-slate-300 sm:block">{employeeName}</div>
            )}
            <Link
              href="/sales-pwa/announcements"
              className="relative rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10"
              aria-label="الإعلانات"
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && (
                <span
                  aria-label={`${unread} إعلانات غير مقروءة`}
                  className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-5">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                    active
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "text-slate-300 hover:bg-white/5 hover:text-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.labelHe && (
                    <span className="text-[10px] text-slate-500">{item.labelHe}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="إغلاق القائمة"
              className="absolute inset-0 bg-black/60"
              onClick={() => setDrawerOpen(false)}
            />
            <nav className="absolute right-0 top-0 h-full w-64 overflow-y-auto border-l border-white/10 bg-slate-950 p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-black">القائمة</div>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                      active
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "text-slate-300 hover:bg-white/5",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="min-w-0 flex-1 pb-20 md:pb-4">{children}</main>
      </div>

      {/* Bottom tab nav (mobile only) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.filter((i) => i.showInBottomNav).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                  active ? "text-emerald-400" : "text-slate-400 hover:text-slate-200",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
