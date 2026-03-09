"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useInboxBadge } from "@/lib/crm/inbox";
import { Logo } from "@/components/shared/Logo";

const NAV = [
  { key: "dashboard", href: "/crm", icon: "📊", label: "داشبورد" },
  { key: "inbox", href: "/crm/inbox", icon: "📨", label: "صندوق الوارد" },
  { key: "orders", href: "/crm/orders", icon: "📦", label: "الطلبات" },
  { key: "customers", href: "/crm/customers", icon: "👥", label: "الزبائن" },
  { key: "pipeline", href: "/crm/pipeline", icon: "🎯", label: "Pipeline" },
  { key: "tasks", href: "/crm/tasks", icon: "✅", label: "المهام" },
  { key: "chats", href: "/crm/chats", icon: "💬", label: "المحادثات" },
  { key: "users", href: "/crm/users", icon: "🔑", label: "الفريق" },
];

export function CRMShell({ children }: { children: React.ReactNode }) {
  const scr = useScreen();
  const pathname = usePathname();
  const active = NAV.find((n) => pathname === n.href || (n.href !== "/crm" && pathname.startsWith(n.href)))?.key || "dashboard";
  const inboxBadge = useInboxBadge();

  if (scr.mobile) {
    return (
      <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen pb-16">
        <div className="bg-surface-card border-b border-surface-border px-3 py-2.5 flex items-center justify-between sticky top-0 z-50">
          <Link href="/crm" className="flex items-center gap-1.5">
            <Logo size={28} showText label="ClalCRM" />
          </Link>
          <span className="text-[10px] text-muted">إدارة العلاقات</span>
        </div>
        <div className="p-3">{children}</div>
        <nav className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border flex z-50">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className="flex-1 flex flex-col items-center py-1.5 relative"
              style={{ color: active === n.key ? "#c41040" : "#71717a" }}>
              <span className="text-base relative">
                {n.icon}
                {n.key === "inbox" && inboxBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {inboxBadge > 99 ? "99+" : inboxBadge}
                  </span>
                )}
              </span>
              <span className="text-[8px] font-bold mt-0.5">{n.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen flex">
      <aside className="w-56 bg-surface-card border-l border-surface-border flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-surface-border">
          <Link href="/crm" className="flex items-center gap-2">
            <Logo size={36} showText label="ClalCRM" subtitle="إدارة العلاقات" />
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm"
              style={{ background: active === n.key ? "rgba(196,16,64,0.08)" : "transparent", color: active === n.key ? "#c41040" : "#a1a1aa", fontWeight: active === n.key ? 700 : 500 }}>
              <span>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.key === "inbox" && inboxBadge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {inboxBadge > 99 ? "99+" : inboxBadge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-surface-border">
          <Link href="/store" className="flex items-center gap-2 text-muted text-xs hover:text-white px-3 py-2">🛒 المتجر</Link>
          <Link href="/admin" className="flex items-center gap-2 text-muted text-xs hover:text-white px-3 py-2">⚙️ الأدمن</Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
