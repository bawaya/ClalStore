"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Truck,
  WalletCards,
} from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import type { Hero } from "@/types/database";

const FALLBACK_HEROES: Hero[] = [
  {
    id: "h1",
    title_ar: "موسم هواتف وعروض واضحة",
    title_he: "עונת סמארטפונים ומבצעים ברורים",
    subtitle_ar:
      "واجهة بيع رسمية تضع الجهاز والسعر وخيار الشراء في المقدمة من دون ضجيج بصري.",
    subtitle_he:
      "ממשק מכירה רשמי שמציב את המכשיר, המחיר והחלטת הקנייה במרכז בלי עומס חזותי.",
    image_url: "",
    link_url: "/store",
    cta_text_ar: "تسوّق الآن",
    cta_text_he: "עברו לחנות",
    sort_order: 1,
    active: true,
    created_at: "",
  },
  {
    id: "h2",
    title_ar: "هواتف رائدة مع تقسيط واضح",
    title_he: "מכשירי דגל עם תשלומים ברורים",
    subtitle_ar:
      "اختصر الطريق: ابحث بسرعة، قارن الخيارات، واتخذ القرار من نفس الواجهة.",
    subtitle_he:
      "קצרו את הדרך: חפשו מהר, השוו אפשרויות וקבלו החלטה מאותה תצוגה.",
    image_url: "",
    link_url: "/store",
    cta_text_ar: "استعرض الأجهزة",
    cta_text_he: "צפו במכשירים",
    sort_order: 2,
    active: true,
    created_at: "",
  },
];

export function HeroCarousel({ heroes }: { heroes?: Hero[] }) {
  const scr = useScreen();
  const { lang } = useLang();
  const items = heroes && heroes.length > 0 ? heroes : FALLBACK_HEROES;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((current) => (current + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  const hero = items[idx];
  const title = lang === "he" ? hero.title_he || hero.title_ar : hero.title_ar;
  const subtitle =
    lang === "he" ? hero.subtitle_he || hero.subtitle_ar : hero.subtitle_ar;
  const ctaText =
    lang === "he"
      ? hero.cta_text_he || hero.cta_text_ar || "צפו בפרטים"
      : hero.cta_text_ar || "اعرف المزيد";

  const signals = useMemo(
    () =>
      lang === "he"
        ? [
            { icon: Truck, label: "משלוח מהיר" },
            { icon: ShieldCheck, label: "אחריות רשמית" },
            { icon: WalletCards, label: "תשלומים ברורים" },
          ]
        : [
            { icon: Truck, label: "شحن سريع" },
            { icon: ShieldCheck, label: "ضمان رسمي" },
            { icon: WalletCards, label: "تقسيط واضح" },
          ],
    [lang]
  );

  const stats = useMemo(
    () =>
      lang === "he"
        ? [
            { value: "3", label: "שלבי החלטה ברורים" },
            { value: "24/7", label: "גישה לחיפוש" },
            { value: "RTL", label: "ממשק מותאם" },
          ]
        : [
            { value: "3", label: "خطوات شراء واضحة" },
            { value: "24/7", label: "بحث جاهز دائمًا" },
            { value: "RTL", label: "واجهة مضبوطة" },
          ],
    [lang]
  );

  const sectionCopy =
    lang === "he"
      ? {
          badge: "חזית מכירה מסודרת",
          slide: "מיקוד החנות",
          counter: `${idx + 1} / ${items.length}`,
        }
      : {
          badge: "واجهة بيع مرتبة",
          slide: "تركيز المتجر",
          counter: `${idx + 1} / ${items.length}`,
        };

  const goPrev = () => setIdx((current) => (current - 1 + items.length) % items.length);
  const goNext = () => setIdx((current) => (current + 1) % items.length);

  return (
    <section
      className="border-b border-[#1b1b22] bg-[#0c0c0f]"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
      }}
    >
      <div
        className="mx-auto max-w-[1540px]"
        style={{ padding: scr.mobile ? "14px 14px 18px" : "18px 24px 22px" }}
      >
        <div className="overflow-hidden rounded-[30px] border border-[#2b2b33] bg-[linear-gradient(180deg,rgba(22,22,27,0.98),rgba(13,13,17,0.98))] shadow-[0_28px_60px_rgba(0,0,0,0.32)]">
          <div className="grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-7 lg:py-7">
            <div className="flex flex-col justify-between">
              <div>
                <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                  {sectionCopy.badge}
                </span>

                <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight md:text-[2.9rem]">
                  {title}
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                  {subtitle}
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {signals.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-[20px] border border-[#2f2f38] bg-white/[0.03] px-4 py-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ff3351]/20 bg-[#ff3351]/10 text-[#ff7b91]">
                        <Icon size={18} />
                      </div>
                      <span className="text-sm font-semibold text-[#ececf0]">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={hero.link_url || "/store"}
                  className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-[#ff0e34] px-6 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
                >
                  {ctaText}
                </a>

                {items.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goPrev}
                      aria-label={lang === "he" ? "שקופית קודמת" : "الشريحة السابقة"}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#34343d] bg-[#17171b] text-[#d5d5dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label={lang === "he" ? "שקופית הבאה" : "الشريحة التالية"}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#34343d] bg-[#17171b] text-[#d5d5dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="relative min-h-[240px] overflow-hidden rounded-[26px] border border-[#31313a] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,51,81,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_28%)]" />

                {hero.image_url ? (
                  <Image
                    src={hero.image_url}
                    alt={title}
                    fill
                    className="object-contain p-6"
                    sizes="(max-width: 1024px) 100vw, 390px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                    <div>
                      <div className="mx-auto h-24 w-24 rounded-[28px] border border-[#ff3351]/20 bg-[#ff3351]/10 shadow-[0_16px_35px_rgba(255,14,52,0.18)]" />
                      <div className="mt-4 text-sm font-semibold text-[#f3f3f5]">
                        {title}
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(12,12,15,0),rgba(12,12,15,0.92))] px-5 py-4">
                  <div className="text-xs font-semibold text-[#ff8da0]">
                    {sectionCopy.slide}
                  </div>
                  <div className="mt-1 text-lg font-black text-white">{title}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4"
                  >
                    <strong className="block text-xl font-black text-white">
                      {stat.value}
                    </strong>
                    <span className="text-sm text-[#b8b8c2]">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {items.length > 1 && (
            <div className="flex items-center justify-between border-t border-[#23232b] px-5 py-4 lg:px-7">
              <div className="flex items-center gap-2">
                {items.map((item, slideIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIdx(slideIndex)}
                    aria-label={`${slideIndex + 1}`}
                    className="transition-all"
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: idx === slideIndex ? 28 : 8,
                        height: 8,
                        background:
                          idx === slideIndex ? "#ff3351" : "rgba(255,255,255,0.18)",
                      }}
                    />
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-[#8f8f99]">
                {sectionCopy.counter}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
