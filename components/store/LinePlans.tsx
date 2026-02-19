"use client";

import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import type { LinePlan } from "@/types/database";

const FALLBACK_PLANS: LinePlan[] = [
  { id: "l1", name_ar: "بيسك", name_he: "בייסיק", data_amount: "10GB", price: 29, features_ar: ["10GB داتا", "دقائق غير محدودة", "SMS غير محدود"], features_he: ["10GB דאטא", "דקות ללא הגבלה", "SMS ללא הגבלה"], popular: false, active: true, sort_order: 1, created_at: "" },
  { id: "l2", name_ar: "بريميوم", name_he: "פרימיום", data_amount: "50GB", price: 59, features_ar: ["50GB داتا", "دقائق غير محدودة", "SMS غير محدود", "5GB تجوال"], features_he: ["50GB דאטא", "דקות ללא הגבלה", "SMS ללא הגבלה", "5GB רומינג"], popular: true, active: true, sort_order: 2, created_at: "" },
  { id: "l3", name_ar: "ألترا", name_he: "אולטרה", data_amount: "100GB", price: 89, features_ar: ["100GB داتا", "دقائق غير محدودة", "SMS غير محدود", "15GB تجوال", "HOT TV"], features_he: ["100GB דאטא", "דקות ללא הגבלה", "SMS ללא הגבלה", "15GB רומינג", "HOT TV"], popular: false, active: true, sort_order: 3, created_at: "" },
];

export function LinePlans({ plans }: { plans?: LinePlan[] }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const { toasts, show } = useToast();
  const items = plans && plans.length > 0 ? plans : FALLBACK_PLANS;

  return (
    <div style={{ marginTop: scr.mobile ? 20 : 32 }}>
      <h2 className="font-black text-center mb-4" style={{ fontSize: scr.mobile ? 16 : 22 }}>
        {t("plans.title")}
      </h2>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}
      >
        {items.map((l) => (
          <div
            key={l.id}
            className="card text-center relative"
            style={{
              padding: scr.mobile ? 14 : 20,
              border: l.popular ? "2px solid #c41040" : undefined,
            }}
          >
            {l.popular && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-white text-[8px] font-bold px-2.5 py-0.5 rounded-md">
                {t("plans.popular")}
              </div>
            )}
            <div className="font-black mb-1" style={{ fontSize: scr.mobile ? 14 : 18 }}>
              {lang === "he" ? (l.name_he || l.name_ar) : l.name_ar}
            </div>
            <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 24 : 32 }}>
              {l.data_amount}
            </div>
            <div className="text-muted mb-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              ₪{l.price}{t("plans.perMonth")}
            </div>
            {(lang === "he" ? (l.features_he?.length ? l.features_he : l.features_ar) : l.features_ar).map((f, i) => (
              <div key={i} className="text-muted mb-0.5" style={{ fontSize: scr.mobile ? 8 : 10 }}>
                ✓ {f}
              </div>
            ))}
            <button
              onClick={() => show(t("errors.planActivation"), "success")}
              className="btn-primary w-full mt-2.5"
              style={{ fontSize: scr.mobile ? 10 : 12, padding: "8px 16px" }}
            >
              {t("plans.choose")}
            </button>
          </div>
        ))}
      </div>

      {toasts.map((t) => (
        <div
          key={t.id}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 card border-state-success text-state-success font-bold z-[999] shadow-2xl px-6 py-3 text-sm"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
