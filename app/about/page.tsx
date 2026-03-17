"use client";

import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { Navbar, Footer } from "@/components/website/sections";

export default function AboutPage() {
  const scr = useScreen();
  const { t } = useLang();
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto" style={{ paddingTop: scr.mobile ? 80 : 100, padding: scr.mobile ? "80px 16px 40px" : "100px 24px 64px" }}>
        <h1 className="font-black text-center mb-6" style={{ fontSize: scr.mobile ? 24 : 36 }}>{t("about.title")}</h1>

        <div className="card" style={{ padding: scr.mobile ? 20 : 32 }}>
          <div className="space-y-4 text-muted leading-relaxed" style={{ fontSize: scr.mobile ? 13 : 15 }}>
            <p>
              <strong className="text-white">ClalMobile</strong> {t("about.p1").replace("ClalMobile ", "")}
            </p>
            <p>{t("about.p2")}</p>
            <p>{t("about.p3")}</p>

            <h2 className="font-black text-white text-right" style={{ fontSize: scr.mobile ? 16 : 20 }}>{t("about.vision")}</h2>
            <p>{t("about.visionText")}</p>

            <h2 className="font-black text-white text-right" style={{ fontSize: scr.mobile ? 16 : 20 }}>{t("about.values")}</h2>
            <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
              {[
                { icon: "✅", titleKey: "quality", descKey: "qualityDesc" },
                { icon: "🤝", titleKey: "trust", descKey: "trustDesc" },
                { icon: "⚡", titleKey: "speed", descKey: "speedDesc" },
                { icon: "💰", titleKey: "value", descKey: "valueDesc" },
              ].map((v) => (
                <div key={v.titleKey} className="bg-surface-elevated rounded-xl p-3">
                  <span className="text-lg">{v.icon}</span>
                  <div className="font-bold text-white text-sm mt-1">{t(`about.${v.titleKey}`)}</div>
                  <div className="text-muted text-xs">{t(`about.${v.descKey}`)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
