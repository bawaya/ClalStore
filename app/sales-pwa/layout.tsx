import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SalesPwaInit } from "@/components/pwa/SalesPwaInit";

export const metadata: Metadata = {
  title: "Sales Docs — ClalMobile",
  description: "Offline-first sales documentation for employees",
  manifest: "/sales-pwa/manifest.json",
  themeColor: "#0b1220",
};

export default function SalesPwaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <SalesPwaInit />

      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2">
            <div className="text-lg font-black tracking-tight">توثيق المبيعات</div>
            <div className="text-xs text-slate-400">PWA</div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a className="rounded-lg px-2 py-1 hover:bg-white/5" href="/sales-pwa">العمليات</a>
            <a className="rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-200 hover:bg-emerald-500/20" href="/sales-pwa/new">عملية جديدة</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
