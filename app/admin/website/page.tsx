"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useScreen, useToast } from "@/lib/hooks";
import { EmptyState, PageHeader, ToastContainer } from "@/components/admin/shared";
import type { Hero, SubPage, WebsiteContent } from "@/types/database";

type ContentSummary = {
  sections: number;
  heroes: number;
  subPages: number;
  lastUpdated: string | null;
};

const CONTENT_LINKS = [
  {
    href: "/admin/homepage",
    icon: "🏠",
    title: "واجهة المتجر",
    sub: "الرأس والهيرو والبنرات والأقسام الرئيسية والصفحات الفرعية",
    key: "sections" as const,
  },
  {
    href: "/admin/heroes",
    icon: "🖼️",
    title: "صور الهيرو والبنرات",
    sub: "الشرائح والصور الرئيسية وتحسينها وإعادة ترتيبها",
    key: "heroes" as const,
  },
  {
    href: "/admin/deals",
    icon: "🎯",
    title: "العروض التجارية",
    sub: "العروض المرتبطة بالواجهة والشرائح الترويجية",
    key: "none" as const,
  },
  {
    href: "/admin/settings",
    icon: "⚙️",
    title: "الشعار والإعدادات العامة",
    sub: "الشعار والهوية العامة وروابط النظام",
    key: "none" as const,
  },
];

export default function WebsiteContentPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ContentSummary>({
    sections: 0,
    heroes: 0,
    subPages: 0,
    lastUpdated: null,
  });

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [websiteRes, heroesRes, subPagesRes] = await Promise.all([
        fetch("/api/admin/website"),
        fetch("/api/admin/heroes"),
        fetch("/api/admin/sub-pages"),
      ]);

      const [websiteJson, heroesJson, subPagesJson] = await Promise.all([
        websiteRes.json(),
        heroesRes.json(),
        subPagesRes.json(),
      ]);

      const sections = (websiteJson.data || []) as WebsiteContent[];
      const heroes = Array.isArray(heroesJson.data) ? (heroesJson.data as Hero[]) : [];
      const subPages = Array.isArray(subPagesJson.data) ? (subPagesJson.data as SubPage[]) : [];

      const latestWebsiteUpdate =
        sections
          .map((item) => item.updated_at)
          .filter(Boolean)
          .sort()
          .at(-1) || null;

      setSummary({
        sections: sections.length,
        heroes: heroes.length,
        subPages: subPages.length,
        lastUpdated: latestWebsiteUpdate,
      });
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) return <div className="py-20 text-center text-muted">⏳ جاري التحميل...</div>;

  if (summary.sections === 0 && summary.heroes === 0 && summary.subPages === 0) {
    return (
      <div>
        <PageHeader title="🗂️ مركز المحتوى" count={0} />
        <EmptyState
          icon="🗂️"
          title="لا يوجد محتوى قابل للإدارة بعد"
          sub="ابدأ من واجهة المتجر أو من مكتبة صور الهيرو والبنرات."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="🗂️ مركز المحتوى" count={summary.sections + summary.heroes + summary.subPages} />

      <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18, borderColor: "rgba(196,16,64,0.22)" }}>
        <div className="text-right">
          <div className="text-xs font-bold text-brand">مرجع المحتوى بعد التحديث الجديد</div>
          <div className="mt-1 text-[11px] leading-6 text-muted">
            تم تركيز التحكم المباشر في واجهة المتجر داخل صفحة واحدة واضحة، مع إبقاء مكتبة صور الهيرو والبنرات كمدخل سريع مستقل.
          </div>
        </div>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: scr.mobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}
      >
        {CONTENT_LINKS.map((item) => {
          const countText =
            item.key === "sections"
              ? `${summary.sections} أقسام و ${summary.subPages} صفحات فرعية`
              : item.key === "heroes"
                ? `${summary.heroes} شريحة رئيسية`
                : "مسار مرتبط بالمحتوى العام";

          return (
            <Link
              key={item.href}
              href={item.href}
              className="card group flex items-center gap-4 rounded-3xl border border-surface-border px-4 py-4 text-right transition-all hover:border-brand/30 hover:bg-brand/5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl">
                {item.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-white">{item.title}</div>
                <div className="mt-1 text-[11px] leading-5 text-muted">{item.sub}</div>
                <div className="mt-2 text-[11px] font-bold text-brand">{countText}</div>
              </div>

              <ChevronLeft size={18} className="shrink-0 text-[#7f7f89] transition-transform group-hover:-translate-x-0.5" />
            </Link>
          );
        })}
      </div>

      <div className="card mt-4" style={{ padding: scr.mobile ? 12 : 18 }}>
        <div className="mb-3 text-right">
          <div className="text-xs font-bold text-brand">ملخص المحتوى الحالي</div>
          <div className="mt-1 text-[11px] text-muted">نظرة سريعة قبل الدخول إلى صفحات التحرير التنفيذية.</div>
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))" }}
        >
          <div className="rounded-2xl border border-surface-border bg-surface-elevated/50 px-4 py-4 text-right">
            <div className="text-[11px] text-muted">أقسام واجهة المتجر</div>
            <div className="mt-1 text-2xl font-black text-white">{summary.sections}</div>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-elevated/50 px-4 py-4 text-right">
            <div className="text-[11px] text-muted">صور الهيرو والبنرات</div>
            <div className="mt-1 text-2xl font-black text-white">{summary.heroes}</div>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-elevated/50 px-4 py-4 text-right">
            <div className="text-[11px] text-muted">الصفحات الفرعية</div>
            <div className="mt-1 text-2xl font-black text-white">{summary.subPages}</div>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-elevated/50 px-4 py-4 text-right">
            <div className="text-[11px] text-muted">آخر تحديث</div>
            <div className="mt-1 text-sm font-bold text-white">
              {summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleDateString("ar") : "—"}
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
