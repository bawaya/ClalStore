"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  Bot,
  ChevronLeft,
  FileImage,
  FilePenLine,
  FileSpreadsheet,
  FolderTree,
  Home,
  House,
  ImageIcon,
  LayoutDashboard,
  Laptop2,
  Menu,
  Megaphone,
  Settings,
  ShoppingCart,
  Smartphone,
  Star,
  Store,
  TabletSmartphone,
  TicketPercent,
  Tv,
  Users,
  WalletCards,
  Wifi,
  X,
} from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";

type NavItem = {
  key: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type NavSection = {
  key: string;
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    key: "dashboard",
    title: "لوحة التحكم",
    items: [
      {
        key: "dashboard",
        href: "/admin",
        label: "نظرة عامة",
        description: "المؤشرات والتنبيهات والاختصارات اليومية",
        icon: LayoutDashboard,
      },
      {
        key: "orders",
        href: "/admin/orders",
        label: "الطلبات",
        description: "إدارة الطلبات ومسار التنفيذ",
        icon: ShoppingCart,
      },
      {
        key: "analytics",
        href: "/admin/analytics",
        label: "التحليلات",
        description: "قراءة الأداء التجاري وحركة المتجر",
        icon: BarChart3,
      },
    ],
  },
  {
    key: "catalog",
    title: "الكتالوج والتجارة",
    items: [
      {
        key: "products",
        href: "/admin/products",
        label: "الهواتف والإكسسوارات",
        description: "الأجهزة الرئيسية والملحقات وأدوات الصور",
        icon: Smartphone,
      },
      {
        key: "appliances",
        href: "/admin/appliances",
        label: "المنزل الذكي",
        description: "الأجهزة المنزلية والمنتجات الذكية",
        icon: House,
      },
      {
        key: "tvs",
        href: "/admin/tvs",
        label: "التلفزيونات",
        description: "الشاشات والتلفزيونات الذكية",
        icon: Tv,
      },
      {
        key: "computers",
        href: "/admin/computers",
        label: "الحواسيب",
        description: "الحواسيب والطابعات والملحقات",
        icon: Laptop2,
      },
      {
        key: "tablets",
        href: "/admin/tablets",
        label: "الأجهزة اللوحية",
        description: "الأجهزة اللوحية وملحقاتها",
        icon: TabletSmartphone,
      },
      {
        key: "network",
        href: "/admin/network",
        label: "الشبكات",
        description: "الراوترات وموسعات التغطية",
        icon: Wifi,
      },
      {
        key: "categories",
        href: "/admin/categories",
        label: "الفئات والتصنيفات",
        description: "الربط بين الكتالوج وأقسام المتجر",
        icon: FolderTree,
      },
      {
        key: "deals",
        href: "/admin/deals",
        label: "العروض",
        description: "العروض الخاصة والشرائح الترويجية",
        icon: TicketPercent,
      },
      {
        key: "coupons",
        href: "/admin/coupons",
        label: "الكوبونات",
        description: "أكواد الخصم وقواعد استخدامها",
        icon: TicketPercent,
      },
      {
        key: "lines",
        href: "/admin/lines",
        label: "الباقات والخطوط",
        description: "باقات الخطوط والعروض المرتبطة بها",
        icon: Wifi,
      },
      {
        key: "reviews",
        href: "/admin/reviews",
        label: "التقييمات",
        description: "محتوى الثقة وآراء العملاء",
        icon: Star,
      },
    ],
  },
  {
    key: "content",
    title: "واجهة المتجر والمحتوى",
    items: [
      {
        key: "homepage",
        href: "/admin/homepage",
        label: "واجهة المتجر",
        description: "الرأس والهيرو والبنرات والأقسام الرئيسية",
        icon: Home,
      },
      {
        key: "heroes",
        href: "/admin/heroes",
        label: "صور الهيرو والبنرات",
        description: "الشرائح والصور الرئيسية وتحسينها",
        icon: ImageIcon,
      },
      {
        key: "website",
        href: "/admin/website",
        label: "مركز المحتوى",
        description: "خارطة المحتوى وروابط الإدارة السريعة",
        icon: FileImage,
      },
      {
        key: "features",
        href: "/admin/features",
        label: "ميزات المتجر",
        description: "العناصر التسويقية والرسائل البصرية",
        icon: Star,
      },
    ],
  },
  {
    key: "growth",
    title: "التواصل والنمو",
    items: [
      {
        key: "push",
        href: "/admin/push",
        label: "الإشعارات",
        description: "الرسائل والتنبيهات المرسلة للعملاء",
        icon: BellRing,
      },
      {
        key: "bot",
        href: "/admin/bot",
        label: "البوت",
        description: "ضبط تجربة المساعد والردود الآلية",
        icon: Bot,
      },
    ],
  },
  {
    key: "team",
    title: "الفريق والعمولات",
    items: [
      {
        key: "commissions",
        href: "/admin/commissions",
        label: "العمولات",
        description: "لوحة العمولات وأداء الفريق",
        icon: WalletCards,
      },
      {
        key: "corrections",
        href: "/admin/commissions/corrections",
        label: "طلبات التصحيح",
        description: "مراجعة التعديلات والتصحيحات",
        icon: FilePenLine,
      },
      {
        key: "announcements",
        href: "/admin/announcements",
        label: "رسائل الموظفين",
        description: "الإعلانات الداخلية والتحديثات",
        icon: Megaphone,
      },
    ],
  },
  {
    key: "system",
    title: "النظام",
    items: [
      {
        key: "import-excel",
        href: "/admin/import-excel",
        label: "الاستيراد",
        description: "رفع ملفات البيانات والتغذية السريعة",
        icon: FileSpreadsheet,
      },
      {
        key: "settings",
        href: "/admin/settings",
        label: "الإعدادات",
        description: "الشعار والإعدادات العامة والتكاملات",
        icon: Settings,
      },
    ],
  },
];

const MOBILE_SHORTCUT_KEYS = ["dashboard", "orders", "products", "homepage"];
const FLAT_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

function isItemActive(pathname: string, item: NavItem) {
  if (item.href === "/admin") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function AdminNavItem({
  item,
  active,
  compact = false,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl transition-all ${
        compact ? "px-3 py-2.5" : "px-3.5 py-3"
      }`}
      style={{
        background: active ? "linear-gradient(135deg, rgba(196,16,64,0.18), rgba(196,16,64,0.07))" : "transparent",
        border: `1px solid ${active ? "rgba(196,16,64,0.28)" : "transparent"}`,
        color: active ? "#ffffff" : "#b4b4be",
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all"
        style={{
          background: active ? "rgba(196,16,64,0.18)" : "rgba(255,255,255,0.04)",
          color: active ? "#f97393" : "#a1a1aa",
        }}
      >
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1 text-right">
        <div className="truncate text-sm font-bold">{item.label}</div>
        {!compact && <div className="mt-0.5 truncate text-[11px] text-[#7f7f89]">{item.description}</div>}
      </div>

      {!compact && (
        <ChevronLeft
          size={16}
          className="shrink-0 transition-transform group-hover:-translate-x-0.5"
          style={{ color: active ? "#f97393" : "#5f5f68" }}
        />
      )}
    </Link>
  );
}

function AdminNavSection({
  section,
  pathname,
  compact = false,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="px-2 text-right text-[11px] font-bold tracking-wide text-[#6d6d76]">{section.title}</div>
      <div className="space-y-1">
        {section.items.map((item) => (
          <AdminNavItem
            key={item.key}
            item={item}
            active={isItemActive(pathname, item)}
            compact={compact}
            onClick={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const scr = useScreen();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeItem = useMemo(
    () => FLAT_NAV_ITEMS.find((item) => isItemActive(pathname, item)) || FLAT_NAV_ITEMS[0],
    [pathname]
  );
  const activeSection = useMemo(
    () => NAV_SECTIONS.find((section) => section.items.some((item) => item.key === activeItem.key)) || NAV_SECTIONS[0],
    [activeItem.key]
  );
  const mobileShortcuts = useMemo(
    () => MOBILE_SHORTCUT_KEYS.map((key) => FLAT_NAV_ITEMS.find((item) => item.key === key)).filter(Boolean) as NavItem[],
    []
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (scr.mobile) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#0c0c0f] font-arabic text-white">
        <div className="sticky top-0 z-50 border-b border-white/5 bg-[#101014]/95 backdrop-blur">
          <div className="flex items-center justify-between px-3 py-3">
            <button
              type="button"
              aria-label="فتح القائمة"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
            >
              <Menu size={18} />
            </button>

            <Link href="/admin" className="flex items-center gap-2">
              <Logo size={30} showText label="ClalMobile" subtitle="الإدارة" />
            </Link>

            <div className="text-right">
              <div className="text-[10px] text-[#7f7f89]">{activeSection.title}</div>
              <div className="text-[11px] font-bold">{activeItem.label}</div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {mobileShortcuts.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold transition-all"
                  style={{
                    background: active ? "rgba(196,16,64,0.16)" : "rgba(255,255,255,0.04)",
                    borderColor: active ? "rgba(196,16,64,0.28)" : "rgba(255,255,255,0.08)",
                    color: active ? "#fff" : "#b4b4be",
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="px-3 py-4 pb-6">{children}</div>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[80]">
            <button
              type="button"
              aria-label="إغلاق القائمة"
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            <aside
              className="absolute right-0 top-0 flex h-full flex-col border-l border-white/10 bg-[#101014] px-4 py-4 shadow-2xl"
              style={{ width: "min(88vw, 360px)" }}
            >
              <div className="mb-4 flex items-center justify-between border-b border-white/6 pb-4">
                <button
                  type="button"
                  aria-label="إغلاق القائمة"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
                >
                  <X size={18} />
                </button>

                <div className="text-right">
                  <div className="text-sm font-black">خارطة الإدارة</div>
                  <div className="mt-1 text-[11px] text-[#7f7f89]">تنظيم مطابق لمسميات المتجر الجديدة</div>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto pb-4">
                {NAV_SECTIONS.map((section) => (
                  <AdminNavSection
                    key={section.key}
                    section={section}
                    pathname={pathname}
                    compact
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/6 pt-4">
                <Link
                  href="/store"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-[#c9c9d1]"
                >
                  <Store size={16} />
                  <span>المتجر</span>
                </Link>
                <Link
                  href="/crm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-[#c9c9d1]"
                >
                  <Users size={16} />
                  <span>إدارة العلاقات</span>
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-[#0c0c0f] font-arabic text-white">
      <aside className="sticky top-0 flex h-screen w-[21rem] shrink-0 flex-col border-l border-white/6 bg-[#101014]">
        <div className="border-b border-white/6 px-5 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo size={38} showText label="ClalMobile" subtitle="منصة الإدارة" />
          </Link>

          <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4 text-right">
            <div className="text-[11px] font-bold text-[#7f7f89]">{activeSection.title}</div>
            <div className="mt-1 text-base font-black">{activeItem.label}</div>
            <div className="mt-2 text-xs leading-6 text-[#8e8e98]">{activeItem.description}</div>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {NAV_SECTIONS.map((section) => (
            <AdminNavSection key={section.key} section={section} pathname={pathname} />
          ))}
        </div>

        <div className="border-t border-white/6 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/store"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-[#c9c9d1] transition-colors hover:border-brand/30 hover:text-white"
            >
              <Store size={16} />
              <span>المتجر</span>
            </Link>
            <Link
              href="/crm"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-[#c9c9d1] transition-colors hover:border-brand/30 hover:text-white"
            >
              <Users size={16} />
              <span>العلاقات</span>
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-h-screen flex-1 bg-[#0c0c0f] px-6 py-6">{children}</main>
    </div>
  );
}
