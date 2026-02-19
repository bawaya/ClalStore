// =====================================================
// ClalMobile — Website Components
// Landing page sections + shared navbar/footer
// =====================================================

"use client";

import Link from "next/link";
import { useState } from "react";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";

// ===== Navbar =====
export function Navbar() {
  const scr = useScreen();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/", label: "الرئيسية" },
    { href: "/store", label: "المتجر" },
    { href: "/#plans", label: "الباقات" },
    { href: "/about", label: "من نحن" },
    { href: "/faq", label: "أسئلة شائعة" },
    { href: "/contact", label: "تواصل معنا" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-bg/90 backdrop-blur-xl border-b border-surface-border">
      <div className="max-w-6xl mx-auto flex items-center justify-between" style={{ padding: scr.mobile ? "10px 16px" : "12px 24px" }}>
        {/* CTA */}
        <Link href="/store" className="btn-primary" style={{ fontSize: scr.mobile ? 12 : 14, padding: scr.mobile ? "6px 12px" : "8px 20px" }}>
          🛒 تسوّق الآن
        </Link>

        {/* Desktop links */}
        {scr.desktop && (
          <div className="flex items-center gap-5">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-white font-bold text-sm hover:text-brand transition-colors">{l.label}</Link>
            ))}
          </div>
        )}

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Logo size={36} showText={!scr.mobile} label="ClalMobile" />
        </Link>

        {/* Mobile menu */}
        {scr.mobile && (
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white bg-transparent border-0 cursor-pointer text-xl">☰</button>
        )}
      </div>

      {/* Mobile dropdown */}
      {scr.mobile && menuOpen && (
        <div className="bg-surface-card border-t border-surface-border px-4 py-3 space-y-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className="block text-right text-white font-bold text-sm py-1.5 hover:text-brand">{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}

// ===== Hero Section =====
export function HeroSection() {
  const scr = useScreen();
  return (
    <section className="relative overflow-hidden" style={{ paddingTop: scr.mobile ? 100 : 120, paddingBottom: scr.mobile ? 40 : 80 }}>
      {/* BG gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,16,64,0.15) 0%, transparent 70%)",
      }} />

      <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
        <div className="inline-block bg-brand/10 text-brand text-[10px] font-bold px-3 py-1 rounded-full mb-4">
          🔴 وكيل رسمي لـ HOT Mobile
        </div>

        <h1 className="font-black leading-tight mb-4" style={{ fontSize: scr.mobile ? 28 : 52 }}>
          <span className="text-white">أجهزة ذكية.</span><br />
          <span className="text-brand">باقات مميزة.</span><br />
          <span className="text-white">توصيل لبابك.</span>
        </h1>

        <p className="text-muted max-w-xl mx-auto mb-6" style={{ fontSize: scr.mobile ? 13 : 16 }}>
          أحدث الأجهزة من Samsung و Apple و Xiaomi مع باقات HOT Mobile —
          توصيل مجاني لكل أنحاء إسرائيل خلال 1-2 يوم عمل.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/store" className="btn-primary" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            🛒 تصفّح المتجر
          </Link>
          <Link href="/#plans" className="btn-outline" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            📡 الباقات
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          {["🚚 توصيل مجاني", "✅ ضمان رسمي", "💳 تقسيط حتى 12 دفعة", "📱 وكيل HOT معتمد"].map((b) => (
            <span key={b} className="text-dim text-[12px] bg-surface-elevated px-3 py-1.5 rounded-full">{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Stats Strip =====
export function StatsStrip() {
  const scr = useScreen();
  const stats = [
    { value: "500+", label: "زبون سعيد", icon: "👥" },
    { value: "50+", label: "منتج متوفر", icon: "📱" },
    { value: "24h", label: "توصيل سريع", icon: "🚚" },
    { value: "100%", label: "ضمان رسمي", icon: "✅" },
  ];

  return (
    <section className="bg-surface-card border-y border-surface-border">
      <div className="max-w-6xl mx-auto grid gap-0" style={{
        gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
        padding: scr.mobile ? "16px" : "24px",
      }}>
        {stats.map((s) => (
          <div key={s.label} className="text-center" style={{ padding: scr.mobile ? 8 : 16 }}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 20 : 28 }}>{s.value}</div>
            <div className="text-muted" style={{ fontSize: scr.mobile ? 12 : 14 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== Featured Products =====
export function FeaturedProducts({ products }: { products: any[] }) {
  const scr = useScreen();

  return (
    <section style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>📱 منتجات مميزة</h2>
          <p className="text-muted mt-1" style={{ fontSize: scr.mobile ? 11 : 14 }}>أحدث الأجهزة بأفضل الأسعار</p>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
          {products.slice(0, scr.mobile ? 4 : 8).map((p) => (
            <Link key={p.id} href={`/store/product/${p.id}`} className="card hover:border-brand/30 transition-all group" style={{ padding: scr.mobile ? 12 : 18 }}>
              <div className="w-full aspect-square bg-surface-elevated rounded-xl mb-2 flex items-center justify-center text-3xl">
                {p.type === "device" ? "📱" : "🔌"}
              </div>
              <div className="text-muted text-[11px] mb-0.5">{p.brand}</div>
              <div className="font-bold text-right" style={{ fontSize: scr.mobile ? 13 : 15 }}>{p.name_ar}</div>
              <div className="flex items-center justify-between mt-1">
                {p.old_price && <span className="text-dim line-through text-[12px]">₪{Number(p.old_price).toLocaleString()}</span>}
                <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 16 }}>₪{Number(p.price).toLocaleString()}</span>
              </div>
              {p.stock === 0 && <span className="text-state-error text-[12px]">نفذ من المخزون</span>}
            </Link>
          ))}
        </div>

        <div className="text-center mt-6">
          <Link href="/store" className="btn-outline">عرض كل المنتجات →</Link>
        </div>
      </div>
    </section>
  );
}

// ===== Line Plans Section =====
export function LinePlansSection({ plans }: { plans: any[] }) {
  const scr = useScreen();

  return (
    <section id="plans" className="bg-surface-card border-y border-surface-border" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>📡 باقات HOT Mobile</h2>
          <p className="text-muted mt-1" style={{ fontSize: scr.mobile ? 11 : 14 }}>اختر الباقة المناسبة لك</p>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : plans.length >= 4 ? "1fr 1fr 1fr 1fr" : `repeat(${plans.length}, 1fr)` }}>
          {plans.map((l) => (
            <div key={l.id} className="card relative text-center transition-all" style={{
              padding: scr.mobile ? 16 : 24,
              borderColor: l.popular ? "rgba(196,16,64,0.4)" : undefined,
              background: l.popular ? "rgba(196,16,64,0.03)" : undefined,
            }}>
              {l.popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand text-white text-[11px] font-bold px-3 py-0.5 rounded-full">⭐ الأكثر شعبية</div>}
              <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 18 }}>{l.name_ar}</div>
              <div className="font-black text-brand my-2" style={{ fontSize: scr.mobile ? 28 : 36 }}>{l.data_amount}</div>
              <div className="text-muted mb-3" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                <span className="font-black text-white" style={{ fontSize: scr.mobile ? 18 : 24 }}>₪{l.price}</span>/شهر
              </div>
              <div className="space-y-1 mb-4">
                {(l.features_ar || []).slice(0, 4).map((f: string, i: number) => (
                  <div key={i} className="text-muted" style={{ fontSize: scr.mobile ? 12 : 14 }}>✓ {f}</div>
                ))}
              </div>
              <Link href="/contact" className={l.popular ? "btn-primary w-full" : "btn-outline w-full"} style={{ fontSize: scr.mobile ? 12 : 14 }}>
                اختر الباقة
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Features Section =====
export function FeaturesSection() {
  const scr = useScreen();
  const features = [
    { icon: "🏪", title: "وكيل رسمي", desc: "وكيل معتمد لـ HOT Mobile — أجهزة أصلية بضمان كامل." },
    { icon: "🚚", title: "توصيل مجاني", desc: "نوصل لكل أنحاء إسرائيل خلال 1-2 يوم عمل مجاناً." },
    { icon: "💳", title: "تقسيط مريح", desc: "ادفع بأقساط مريحة حتى 12 دفعة بدون فوائد." },
    { icon: "📱", title: "أحدث الأجهزة", desc: "Samsung, Apple, Xiaomi — أحدث الموديلات بأفضل الأسعار." },
    { icon: "🔒", title: "دفع آمن", desc: "بوابة دفع مؤمنة — بياناتك محمية بالكامل." },
    { icon: "💬", title: "دعم سريع", desc: "فريق دعم متجاوب عبر واتساب، هاتف، وشات." },
  ];

  return (
    <section style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>✨ ليش ClalMobile؟</h2>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
          {features.map((f) => (
            <div key={f.title} className="card text-center" style={{ padding: scr.mobile ? 16 : 24 }}>
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-bold mb-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>{f.title}</div>
              <div className="text-muted" style={{ fontSize: scr.mobile ? 13 : 14 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== FAQ Section =====
export function FAQSection({ faqs }: { faqs?: { q: string; a: string }[] }) {
  const scr = useScreen();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const defaultFaqs = faqs || [
    { q: "كيف أطلب من المتجر؟", a: "ادخل المتجر، اختر المنتج، عبّي بياناتك، وأكّد الطلب. الفريق يتواصل معك خلال ساعات." },
    { q: "كم مدة التوصيل؟", a: "1-2 يوم عمل (أحد-خميس) لكل أنحاء إسرائيل. التوصيل مجاني!" },
    { q: "هل يمكن الدفع بأقساط؟", a: "نعم! تقسيط حتى 12 دفعة لأصحاب الأجهزة. الإكسسوارات دفع مباشر." },
    { q: "ماذا عن الضمان؟", a: "جميع الأجهزة بضمان رسمي كامل من الشركة المصنعة." },
    { q: "هل يمكن إرجاع المنتج؟", a: "نعم، خلال 14 يوم من الاستلام حسب قانون حماية المستهلك الإسرائيلي." },
    { q: "كيف أتابع طلبي؟", a: "أرسل رقم طلبك (CLM-XXXXX) على واتساب أو الشات وتحصل على الحالة فوراً." },
  ];

  return (
    <section id="faq" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>❓ أسئلة شائعة</h2>
        </div>
        <div className="space-y-1.5">
          {defaultFaqs.map((f, i) => (
            <div key={i} className="card cursor-pointer" onClick={() => setOpenIdx(openIdx === i ? null : i)}
              style={{ padding: scr.mobile ? "12px 14px" : "16px 20px" }}>
              <div className="flex items-center justify-between">
                <span className="text-brand transition-transform" style={{ transform: openIdx === i ? "rotate(45deg)" : "rotate(0)", fontSize: 16 }}>+</span>
                <span className="font-bold text-right flex-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>{f.q}</span>
              </div>
              {openIdx === i && (
                <div className="text-muted text-right mt-2 leading-relaxed" style={{ fontSize: scr.mobile ? 11 : 13 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== CTA Section =====
export function CTASection() {
  const scr = useScreen();
  return (
    <section className="relative overflow-hidden" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(196,16,64,0.12) 0%, transparent 70%)",
      }} />
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <h2 className="font-black mb-2" style={{ fontSize: scr.mobile ? 20 : 32 }}>جاهز تبدأ؟ 🚀</h2>
        <p className="text-muted mb-5" style={{ fontSize: scr.mobile ? 12 : 15 }}>
          تصفّح أحدث الأجهزة والباقات — التوصيل مجاني لكل إسرائيل!
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/store" className="btn-primary" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            🛒 ادخل المتجر
          </Link>
          <Link href="/contact" className="btn-outline" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            💬 تواصل معنا
          </Link>
        </div>
      </div>
    </section>
  );
}

// ===== Footer =====
export function Footer() {
  const scr = useScreen();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: "المتجر",
      links: [
        { href: "/store", label: "كل المنتجات" },
        { href: "/store?type=device", label: "أجهزة" },
        { href: "/store?type=accessory", label: "إكسسوارات" },
        { href: "/#plans", label: "باقات HOT" },
      ],
    },
    {
      title: "الشركة",
      links: [
        { href: "/about", label: "من نحن" },
        { href: "/faq", label: "أسئلة شائعة" },
        { href: "/contact", label: "تواصل معنا" },
        { href: "/legal", label: "الشروط والأحكام" },
        { href: "/privacy", label: "سياسة الخصوصية" },
      ],
    },
    {
      title: "تواصل",
      links: [
        { href: "tel:0549414448", label: "📞 054-9414448" },
        { href: "https://wa.me/972549414448", label: "💬 واتساب" },
        { href: "mailto:info@clalmobile.com", label: "📧 info@clalmobile.com" },
      ],
    },
  ];

  return (
    <footer className="bg-surface-card border-t border-surface-border">
      <div className="max-w-6xl mx-auto" style={{ padding: scr.mobile ? "24px 16px" : "48px 24px" }}>
        <div className="grid gap-6" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "2fr 1fr 1fr 1fr" }}>
          {/* Brand */}
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-2">
              <Logo size={32} showText label="ClalMobile" />
            </div>
            <p className="text-muted text-xs leading-relaxed">
              وكيل رسمي لـ HOT Mobile — أجهزة ذكية، باقات مميزة، توصيل مجاني لكل إسرائيل.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title} className="text-right">
              <div className="font-bold text-xs mb-2">{col.title}</div>
              <div className="space-y-1.5">
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href} className="block text-muted text-xs hover:text-white transition-colors">{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-surface-border mt-6 pt-4 flex items-center justify-between">
          <Link href="/privacy" className="text-dim text-[11px] hover:text-muted">سياسة الخصوصية | מדיניות פרטיות</Link>
          <span className="text-dim text-[11px]">© {year} ClalMobile. جميع الحقوق محفوظة.</span>
        </div>
      </div>
    </footer>
  );
}
