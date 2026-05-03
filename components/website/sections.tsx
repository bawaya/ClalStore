// =====================================================
// ClalMobile — Website Components
// Landing page sections + shared navbar/footer
// =====================================================

"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { ProductCard } from "@/components/store/ProductCard";
import type { WebsiteContent } from "@/types/database";

// Cart icon with badge — always visible in Navbar (right-side cluster in RTL)
function CartIconButton() {
  const itemCount = useCart((s) => s.getItemCount());
  return (
    <Link
      href="/store/cart"
      aria-label="السلة"
      className="relative p-2 text-white/80 hover:text-white transition"
    >
      <ShoppingCart size={18} strokeWidth={1.6} />
      {itemCount > 0 && (
        <span className="absolute -top-0.5 -left-1 bg-[#ff0e34] text-white text-[10px] font-medium min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 leading-none">
          {itemCount}
        </span>
      )}
    </Link>
  );
}

// ===== Navbar =====
export function Navbar() {
  const scr = useScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLang();

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/store", label: t("nav.store") },
    { href: "/#plans", label: t("nav.plans") },
    { href: "/payment", label: "كيف ندفع؟" },
    { href: "/about", label: t("nav.about") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <nav
      className="fixed left-0 right-0 z-50 bg-surface-bg/90 backdrop-blur-xl border-b border-surface-border"
      style={{ top: "calc(var(--cart-bar-h, 0px) + var(--top-promo-h, 0px))" }}
    >
      <div
        className="max-w-6xl mx-auto flex items-center justify-between gap-3"
        style={{ padding: scr.mobile ? "10px 16px" : "12px 24px" }}
      >
        {/* RIGHT EDGE in RTL: Logo (first DOM child = right edge in RTL flexbox) */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo size={36} showText={!scr.mobile} label="ClalMobile" />
        </Link>

        {/* CENTER (desktop only): nav links */}
        {scr.desktop && (
          <div className="flex items-center gap-5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-white font-bold text-sm hover:text-brand transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}

        {/* LEFT EDGE in RTL: Shop CTA (desktop only) + Cart + Lang + Hamburger (mobile) */}
        <div className="flex items-center gap-2 shrink-0">
          {scr.desktop && (
            <Link
              href="/store"
              className="btn-primary"
              style={{ fontSize: 14, padding: "8px 20px" }}
            >
              {t("nav.shopNow")}
            </Link>
          )}
          <CartIconButton />
          <LangSwitcher size={scr.mobile ? "sm" : "md"} />
          {scr.mobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="القائمة"
              aria-expanded={menuOpen}
              className="text-white bg-transparent border-0 cursor-pointer text-xl p-1"
            >
              ☰
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {scr.mobile && menuOpen && (
        <div className="bg-surface-card border-t border-surface-border px-4 py-3 space-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block text-right text-white font-bold text-sm py-1.5 hover:text-brand"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

// ===== Hero Section =====
export function HeroSection({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const c = cms?.content || {};

  return (
    <section className="relative overflow-hidden" style={{ paddingTop: scr.mobile ? 100 : 120, paddingBottom: scr.mobile ? 40 : 80 }}>
      {/* BG gradient — preserved from original */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: c.bg_image
          ? `url(${c.bg_image}) center/cover no-repeat`
          : "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,16,64,0.15) 0%, transparent 70%)",
      }} />

      <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
        {/* HOT Mobile official dealer badge — 11px, white/80 (in scale) */}
        <div className="inline-flex items-center gap-1.5 text-[11px] text-white/80 mb-3.5 px-2.5 py-1 border border-[#ff0e34]/40 rounded-full">
          <span className="w-1.5 h-1.5 bg-[#ff0e34] rounded-full"></span>
          وكيل رسمي HOT Mobile
        </div>

        <h1 className="font-black leading-tight mb-2 text-white" style={{ fontSize: scr.mobile ? 28 : 48 }}>
          الأجهزة والباقات اللي بدّك إياها.
        </h1>

        <p className="font-black leading-tight text-white/60 mb-3" style={{ fontSize: scr.mobile ? 22 : 36 }}>
          بالطريقة اللي بترتاح لها.
        </p>

        <p className="text-[13px] text-white/55 max-w-md mx-auto mt-3 mb-3.5 leading-relaxed">
          اشتري اللي بدّك إياه بسعر الكاش. ادفعه على 18 دفعة بدون أي فائدة.
        </p>

        <p className="text-[12px] text-white/40 mb-7">
          هواتف · تابلت / آيباد · لابتوبات · تلفزيونات · منزل ذكي · إكسسوارات
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center items-center">
          <Link
            href="/store"
            className="bg-[#ff0e34] text-white rounded-full px-6 py-2.5 text-[13px] font-medium hover:opacity-90 transition"
          >
            ابدأ التسوّق
          </Link>
          <Link
            href="/payment"
            className="border border-white/30 text-white rounded-full px-6 py-2.5 text-[13px] hover:bg-white/5 transition"
          >
            كيف ندفع؟
          </Link>
        </div>
      </div>
    </section>
  );
}

// ===== Stats Strip (now Trust Strip — value props instead of stats) =====
export function StatsStrip({ cms: _cms }: { cms?: WebsiteContent }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 py-3.5 px-6 border-t border-b border-white/[0.06] text-[11px] text-white/[0.62]">
      <span>18× بسعر الكاش</span>
      <span className="text-white/[0.18]">·</span>
      <span>بدون حجز سقف بطاقة</span>
      <span className="text-white/[0.18]">·</span>
      <span>توصيل 1-2 يوم</span>
      <span className="text-white/[0.18]">·</span>
      <span>ضمان سنتين</span>
    </div>
  );
}

// ===== Featured Products =====
export function FeaturedProducts({ products }: { products: any[] }) {
  const scr = useScreen();
  const { t, lang: _lang } = useLang();

  return (
    <section style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>{t("products.featured")}</h2>
          <p className="text-muted mt-1" style={{ fontSize: scr.mobile ? 11 : 14 }}>{t("products.featuredDesc")}</p>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
          {products.slice(0, scr.mobile ? 4 : 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div className="text-center mt-6">
          <Link href="/store" className="btn-outline">{t("products.viewAll")}</Link>
        </div>
      </div>
    </section>
  );
}

// ===== Line Plans Section =====
export function LinePlansSection({ plans }: { plans: any[] }) {
  const scr = useScreen();
  const { t, lang } = useLang();

  return (
    <section id="plans" className="bg-surface-card border-y border-surface-border" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>{t("plans.title")}</h2>
          <p className="text-muted mt-1" style={{ fontSize: scr.mobile ? 11 : 14 }}>{t("plans.subtitle")}</p>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : plans.length >= 4 ? "1fr 1fr 1fr 1fr" : `repeat(${plans.length}, 1fr)` }}>
          {plans.map((l) => (
            <div key={l.id} className="card relative text-center transition-all" style={{
              padding: scr.mobile ? 16 : 24,
              borderColor: l.popular ? "rgba(196,16,64,0.4)" : undefined,
              background: l.popular ? "rgba(196,16,64,0.03)" : undefined,
            }}>
              {l.popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand text-white text-[11px] font-bold px-3 py-0.5 rounded-full">{t("plans.popular")}</div>}
              <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 18 }}>{lang === "he" ? (l.name_he || l.name_ar) : l.name_ar}</div>
              <div className="font-black text-brand my-2" style={{ fontSize: scr.mobile ? 28 : 36 }}>{l.data_amount}</div>
              <div className="text-muted mb-3" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                <span className="font-black text-white" style={{ fontSize: scr.mobile ? 18 : 24 }}>₪{l.price}</span>{t("plans.perMonth")}
              </div>
              <div className="space-y-1 mb-4">
                {(lang === "he" ? (l.features_he?.length ? l.features_he : l.features_ar) : (l.features_ar || [])).slice(0, 4).map((f: string, i: number) => (
                  <div key={i} className="text-muted" style={{ fontSize: scr.mobile ? 12 : 14 }}>✓ {f}</div>
                ))}
              </div>
              <Link href="/contact" className={l.popular ? "btn-primary w-full" : "btn-outline w-full"} style={{ fontSize: scr.mobile ? 12 : 14 }}>
                {t("plans.choose")}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Features Section ("Why ClalMobile") — 3 focused cards, no icons/emoji =====
export function FeaturesSection({ cms: _cms }: { cms?: WebsiteContent }) {
  const cards = [
    {
      title: "تشتري كأنك بدفع كاش",
      body: "18 دفعة. صفر فوائد. بطاقتك حرة.",
    },
    {
      title: "أصلي. بضمان. من الوكيل الرسمي.",
      body: "Apple, Samsung, Xiaomi. كلها أصلية، كلها بضمان سنتين معتمد.",
    },
    {
      title: "عند بابك خلال يومين",
      body: "توصيل مجاني لكل البلاد. متابعة بكل خطوة.",
    },
  ];

  return (
    <section className="py-12 px-6">
      <h2 className="text-[20px] font-medium text-center mb-6">ليش ClalMobile؟</h2>
      <div className="grid lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-[#0d0d0f] rounded-2xl p-[22px] border border-white/[0.04]"
          >
            <h3 className="text-[14px] font-medium mb-2">{c.title}</h3>
            <p className="text-[12px] text-white/60 leading-[1.55]">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===== FAQ Section — 5 questions, installment-first, null-answer fallback =====
type FaqItem = { q: string; a: string | null };

const DEFAULT_FAQS: FaqItem[] = [
  {
    q: "كيف بشتغل التقسيط بسعر الكاش؟",
    a: "بكل بساطة: السعر اللي بتشوفه هو السعر الحقيقي. بدل ما تدفعه دفعة وحدة، بنقسّمه على 18 شهر بدون أي فائدة. مش تمويل بنكي، يعني سقف بطاقتك بضل حر تستخدمه باللي بدّك. لو بدّك تقسّمه على 36 شهر، عندنا تمويل بنكي مريح كمان.",
  },
  // TODO(Mohammad): fill answers below
  { q: "هل ضروري آخذ باقة عشان أشتري جهاز؟", a: null },
  { q: "كم مدة التوصيل وكيف بتتبّع طلبي؟", a: null },
  { q: "شو الضمان؟ وشو إذا الجهاز خرب؟", a: null },
  { q: "هل بقدر أرجّع/أبدّل الجهاز؟", a: null },
];

export function FAQSection({ faqs, cms }: { faqs?: FaqItem[]; cms?: WebsiteContent }) {
  const scr = useScreen();
  const { lang } = useLang();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const cmsItems = cms?.content?.items;
  const items: FaqItem[] = cmsItems?.length
    ? cmsItems.map((item: any) => ({
        q: lang === "he" ? (item.q_he || item.q_ar) : (item.q_ar || item.q_he),
        a: lang === "he" ? (item.a_he || item.a_ar || null) : (item.a_ar || item.a_he || null),
      }))
    : (faqs || DEFAULT_FAQS);

  return (
    <section id="faq" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>الأسئلة الشائعة</h2>
        </div>
        <div className="space-y-1.5">
          {items.map((f, i) => (
            <div
              key={i}
              className="card cursor-pointer"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenIdx(openIdx === i ? null : i);
                }
              }}
              style={{ padding: scr.mobile ? "12px 14px" : "16px 20px" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-brand transition-transform"
                  style={{ transform: openIdx === i ? "rotate(45deg)" : "rotate(0)", fontSize: 16 }}
                >
                  +
                </span>
                <span className="font-bold text-right flex-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                  {f.q}
                </span>
              </div>
              {openIdx === i && (
                <div
                  className="text-right mt-2 leading-relaxed"
                  style={{ fontSize: scr.mobile ? 11 : 13 }}
                >
                  {f.a ? (
                    <span className="text-muted">{f.a}</span>
                  ) : (
                    <span className="text-white/50">
                      الإجابة قيد التحديث. تواصل معنا عبر واتساب:{" "}
                      <a
                        href="https://wa.me/972533337653"
                        className="text-[#ff0e34] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        053-3337653
                      </a>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== CTA Section — final upsell with mobile-first stacking =====
export function CTASection({ cms: _cms }: { cms?: WebsiteContent }) {
  return (
    <section className="relative overflow-hidden py-14 px-6 text-center">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(196,16,64,0.12) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-3xl mx-auto relative z-10">
        <h2 className="text-[32px] font-medium tracking-tight mb-2.5">ابدأ من هون.</h2>
        <p className="text-[14px] text-white/60 mb-6">
          أحدث الأجهزة، بأفضل الأسعار، وتقسيط بسعر الكاش.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center items-center">
          <Link
            href="/store"
            className="bg-[#ff0e34] text-white rounded-full px-6 py-2.5 text-[13px] font-medium hover:opacity-90 transition"
          >
            تسوّق الأجهزة
          </Link>
          <Link
            href="/#plans"
            className="border border-white/30 text-white rounded-full px-6 py-2.5 text-[13px] hover:bg-white/5 transition"
          >
            شوف الباقات
          </Link>
        </div>
      </div>
    </section>
  );
}

// ===== Footer =====
export function Footer({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t, lang: _lang2 } = useLang();
  const year = new Date().getFullYear();
  const fc = cms?.content || {};

  const columns = [
    {
      title: t("nav.store"),
      links: [
        { href: "/store", label: t("products.viewAll") },
        { href: "/store?type=device", label: t("store.devices") },
        { href: "/store?type=accessory", label: t("store.accessories") },
        { href: "/#plans", label: t("nav.plans") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { href: "/about", label: t("nav.about") },
        { href: "/faq", label: t("nav.faq") },
        { href: "/contact", label: t("nav.contact") },
        { href: "/legal", label: t("footer.legal") },
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/returns", label: t("footer.returns") },
        { href: "/shipping", label: t("footer.shipping") },
        { href: "/warranty", label: t("footer.warranty") },
        { href: "/accessibility", label: t("footer.accessibility") },
      ],
    },
    {
      title: t("footer.contactUs"),
      links: [
        { href: `tel:${fc.phone || "0533337653"}`, label: `📞 ${fc.phone || "053-3337653"}` },
        { href: `https://wa.me/${fc.whatsapp || "972533337653"}`, label: "💬 WhatsApp" },
        { href: `mailto:${fc.email || "info@clalmobile.com"}`, label: `📧 ${fc.email || "info@clalmobile.com"}` },
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
              {t("footer.desc")}
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
        <div className="border-t border-surface-border mt-6 pt-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/privacy" className="text-dim text-[11px] hover:text-muted">{t("footer.privacy")}</Link>
            <Link href="/accessibility" className="text-dim text-[11px] hover:text-muted">♿ {t("footer.accessibility")}</Link>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("clal-consent-reopen"));
                }
              }}
              className="text-dim text-[11px] hover:text-muted bg-transparent border-0 cursor-pointer p-0"
            >
              🍪 {t("footer.manageCookies")}
            </button>
          </div>
          <span className="text-dim text-[11px]">© {year} ClalMobile. {t("footer.rights")}.</span>
        </div>
      </div>
    </footer>
  );
}
