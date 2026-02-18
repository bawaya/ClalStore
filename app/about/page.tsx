"use client";

import { useScreen } from "@/lib/hooks";
import { Navbar, Footer } from "@/components/website/sections";

export default function AboutPage() {
  const scr = useScreen();
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto" style={{ paddingTop: scr.mobile ? 80 : 100, padding: scr.mobile ? "80px 16px 40px" : "100px 24px 64px" }}>
        <h1 className="font-black text-center mb-6" style={{ fontSize: scr.mobile ? 24 : 36 }}>من نحن 🏪</h1>

        <div className="card" style={{ padding: scr.mobile ? 20 : 32 }}>
          <div className="space-y-4 text-muted leading-relaxed" style={{ fontSize: scr.mobile ? 13 : 15 }}>
            <p>
              <strong className="text-white">ClalMobile</strong> هو متجر إلكتروني متخصص ووكيل رسمي معتمد لشركة <strong className="text-brand">HOT Mobile</strong> في إسرائيل.
            </p>
            <p>
              نقدم لزبائننا أحدث الأجهزة الذكية من أكبر العلامات التجارية العالمية مثل Samsung و Apple و Xiaomi، إضافة إلى تشكيلة واسعة من الإكسسوارات عالية الجودة.
            </p>
            <p>
              نؤمن بأن التسوق يجب أن يكون سهلاً ومريحاً — لذلك نوفر توصيل مجاني لكل أنحاء إسرائيل خلال 1-2 يوم عمل، مع خيارات تقسيط مريحة حتى 12 دفعة.
            </p>

            <h2 className="font-black text-white text-right" style={{ fontSize: scr.mobile ? 16 : 20 }}>🎯 رؤيتنا</h2>
            <p>أن نكون الوجهة الأولى لكل عربي في إسرائيل يبحث عن أجهزة ذكية وباقات اتصالات بخدمة ممتازة وأسعار منافسة.</p>

            <h2 className="font-black text-white text-right" style={{ fontSize: scr.mobile ? 16 : 20 }}>💪 قيمنا</h2>
            <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
              {[
                { icon: "✅", title: "الجودة", desc: "منتجات أصلية بضمان رسمي" },
                { icon: "🤝", title: "الثقة", desc: "شفافية كاملة في الأسعار والخدمات" },
                { icon: "⚡", title: "السرعة", desc: "توصيل سريع وخدمة عملاء فورية" },
                { icon: "💰", title: "القيمة", desc: "أفضل الأسعار مع خيارات تقسيط مريحة" },
              ].map((v) => (
                <div key={v.title} className="bg-surface-elevated rounded-xl p-3">
                  <span className="text-lg">{v.icon}</span>
                  <div className="font-bold text-white text-sm mt-1">{v.title}</div>
                  <div className="text-muted text-xs">{v.desc}</div>
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
