"use client";

import { Check, Smartphone, Wifi } from "lucide-react";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import type { LinePlan } from "@/types/database";

const FALLBACK_PLANS: LinePlan[] = [
  {
    id: "l1",
    name_ar: "بداية",
    name_he: "בסיס",
    data_amount: "10GB",
    price: 29,
    features_ar: ["10GB إنترنت", "مكالمات غير محدودة", "رسائل غير محدودة"],
    features_he: ["10GB גלישה", "שיחות ללא הגבלה", "הודעות ללא הגבלה"],
    popular: false,
    active: true,
    sort_order: 1,
    created_at: "",
  },
  {
    id: "l2",
    name_ar: "بريميوم",
    name_he: "פרימיום",
    data_amount: "50GB",
    price: 59,
    features_ar: [
      "50GB إنترنت",
      "مكالمات غير محدودة",
      "رسائل غير محدودة",
      "5GB تجوال",
    ],
    features_he: [
      "50GB גלישה",
      "שיחות ללא הגבלה",
      "הודעות ללא הגבלה",
      "5GB נדידה",
    ],
    popular: true,
    active: true,
    sort_order: 2,
    created_at: "",
  },
  {
    id: "l3",
    name_ar: "ألترا",
    name_he: "אולטרה",
    data_amount: "100GB",
    price: 89,
    features_ar: [
      "100GB إنترنت",
      "مكالمات غير محدودة",
      "رسائل غير محدودة",
      "15GB تجوال",
      "خدمات إضافية",
    ],
    features_he: [
      "100GB גלישה",
      "שיחות ללא הגבלה",
      "הודעות ללא הגבלה",
      "15GB נדידה",
      "שירותים נוספים",
    ],
    popular: false,
    active: true,
    sort_order: 3,
    created_at: "",
  },
];

export function LinePlans({ plans }: { plans?: LinePlan[] }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const { toasts, show } = useToast();
  const items = plans && plans.length > 0 ? plans : FALLBACK_PLANS;

  const sectionCopy =
    lang === "he"
      ? {
          title: t("plans.title"),
          subtitle:
            "חבילות מוצגות באותה שפה חזותית של החנות: מחיר ברור, יתרונות בולטים והחלטה מהירה.",
          meta: "חבילות סלולר",
          monthSuffix: " / לחודש",
        }
      : {
          title: t("plans.title"),
          subtitle:
            "الباقات تظهر بنفس لغة المتجر: سعر مباشر، مزايا مختصرة، وقرار سريع من دون ازدحام.",
          meta: "باقات وخطوط",
          monthSuffix: " / شهريًا",
        };

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#2c2c35] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-[0_28px_60px_rgba(0,0,0,0.28)]">
      <div className="border-b border-[#25252d] px-5 py-5 md:px-7 md:py-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
              {sectionCopy.meta}
            </span>
            <h2
              className="mt-3 font-black text-white"
              style={{ fontSize: scr.mobile ? 22 : 30 }}
            >
              {sectionCopy.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
              {sectionCopy.subtitle}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:min-w-[280px]">
            <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
              <strong className="block text-xl font-black text-white">
                {items.length}
              </strong>
              <span className="text-sm text-[#b8b8c2]">
                {lang === "he" ? "מסלולים זמינים" : "مسارات متاحة"}
              </span>
            </div>
            <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
              <strong className="block text-xl font-black text-white">5G</strong>
              <span className="text-sm text-[#b8b8c2]">
                {lang === "he" ? "גלישה מהירה" : "تغطية سريعة"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid gap-4 px-5 py-5 md:px-7 md:py-6"
        style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}
      >
        {items.map((plan) => {
          const features =
            lang === "he"
              ? plan.features_he?.length
                ? plan.features_he
                : plan.features_ar
              : plan.features_ar;

          return (
            <article
              key={plan.id}
              className={`relative overflow-hidden rounded-[28px] border px-5 py-5 shadow-[0_20px_45px_rgba(0,0,0,0.24)] ${
                plan.popular
                  ? "border-[#ff3351]/45 bg-[linear-gradient(180deg,rgba(255,51,81,0.08),rgba(22,22,27,0.95))]"
                  : "border-[#30303a] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(17,17,21,0.96))]"
              }`}
            >
              {plan.popular && (
                <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-[#ff3351]/25 bg-[#ff3351]/14 px-3 py-1 text-[11px] font-bold text-[#ff9cad]">
                  <Smartphone size={14} />
                  <span>{t("plans.popular")}</span>
                </div>
              )}

              <div className="mt-8">
                <div className="text-sm font-semibold text-[#a7a7b2]">
                  {lang === "he" ? plan.name_he || plan.name_ar : plan.name_ar}
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-4xl font-black text-white md:text-[3rem]">
                      {plan.data_amount}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-[#2f2f38] bg-[#121217] px-3 py-1 text-xs text-[#b9b9c2]">
                      <Wifi size={13} />
                      <span>{lang === "he" ? "גלישה" : "بيانات"}</span>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="text-[30px] font-black text-[#ff3351]">
                      ₪{plan.price}
                    </div>
                    <div className="text-xs text-[#9a9aa5]">
                      {sectionCopy.monthSuffix}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {features.map((feature, index) => (
                  <div
                    key={`${plan.id}-${index}`}
                    className="flex items-start gap-3 rounded-2xl border border-[#2c2c34] bg-white/[0.02] px-3 py-3"
                  >
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#ff3351]/10 text-[#ff7890]">
                      <Check size={14} />
                    </div>
                    <div className="text-sm leading-7 text-[#ececf0]">{feature}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => show(t("errors.planActivation"), "success")}
                className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center rounded-full border border-[#ff0e34] px-5 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
              >
                {t("plans.choose")}
              </button>
            </article>
          );
        })}
      </div>

      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed bottom-5 left-1/2 z-[999] -translate-x-1/2 rounded-2xl border border-[#1f6d47] bg-[#0e241a] px-6 py-3 text-sm font-bold text-[#8ce2ae] shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
        >
          {toast.message}
        </div>
      ))}
    </section>
  );
}
