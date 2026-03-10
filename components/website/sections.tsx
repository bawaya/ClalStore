// =====================================================
// ClalMobile — Website Components
// Landing page sections + shared navbar/footer
// =====================================================

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useScreen } from "@/lib/hooks";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { useLang } from "@/lib/i18n";
import { ProductCard } from "@/components/store/ProductCard";
import { Menu, X, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import type { WebsiteContent } from "@/types/database";

// ===== Navbar =====
export function Navbar() {
  const scr = useScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/store", label: t("nav.store") },
    { href: "/#plans", label: t("nav.plans") },
    { href: "/about", label: t("nav.about") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <nav role="navigation" className="fixed top-0 left-0 right-0 z-50 glass-header glass-glow-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between" style={{ padding: scr.mobile ? "10px 16px" : "12px 24px" }}>
        {/* CTA + Lang + Cart */}
        <div className="flex items-center gap-2">
          <Link
            href="/store/cart"
            className="relative flex items-center justify-center rounded-xl transition-colors hover:bg-white/5"
            style={{ width: scr.mobile ? 34 : 40, height: scr.mobile ? 34 : 40 }}
          >
            <ShoppingCart size={scr.mobile ? 18 : 20} className="text-white" />
            {itemCount > 0 && (
              <span
                className="absolute -top-1 rounded-full font-black flex items-center justify-center"
                style={{
                  insetInlineEnd: -4,
                  width: 18,
                  height: 18,
                  fontSize: 9,
                  background: "linear-gradient(135deg, #c41040, #ff3366)",
                  color: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}
              >
                {itemCount}
              </span>
            )}
          </Link>
          <Link href="/store" className="btn-primary" style={{ fontSize: scr.mobile ? 12 : 14, padding: scr.mobile ? "6px 12px" : "8px 20px" }}>
            {t("nav.shopNow")}
          </Link>
          <LangSwitcher size={scr.mobile ? "sm" : "md"} />
        </div>

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
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white bg-transparent border-0 cursor-pointer"
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
      </div>

      {/* Mobile dropdown */}
      {scr.mobile && menuOpen && (
        <div id="mobile-nav" className="glass-card-static px-4 py-3 space-y-2">
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
export function HeroSection({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const c = cms?.content || {};
  const badge = lang === "he" ? (c.badge_he || t("hero.badge")) : (c.badge_ar || t("hero.badge"));
  const desc = lang === "he" ? (c.description_he || t("hero.desc")) : (c.description_ar || t("hero.desc"));
  const ctaStore = lang === "he" ? (c.cta_store_he || t("hero.browseStore")) : (c.cta_store_ar || t("hero.browseStore"));
  const ctaPlans = lang === "he" ? (c.cta_plans_he || t("hero.viewPlans")) : (c.cta_plans_ar || t("hero.viewPlans"));
  const title = cms ? (lang === "he" ? (cms.title_he || cms.title_ar || "ClalMobile") : (cms.title_ar || "ClalMobile")) : null;

  return (
    <section className="relative overflow-hidden" style={{ paddingTop: scr.mobile ? 100 : 120, paddingBottom: scr.mobile ? 40 : 80 }}>
      {/* BG gradient */}
      {c.bg_image ? (
        <Image
          src={c.bg_image}
          alt=""
          fill
          sizes="100vw"
          className="object-cover pointer-events-none"
          priority
        />
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,16,64,0.15) 0%, transparent 70%)",
        }} />
      )}

      <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
        <div className="inline-block bg-brand/10 text-brand text-[10px] font-bold px-3 py-1 rounded-full mb-4">
          {badge}
        </div>

        <h1 className="font-black leading-tight mb-4" style={{ fontSize: scr.mobile ? 28 : 52 }}>
          <span className="text-white">{title || t("hero.line1")}</span><br />
          <span className="text-brand">{t("hero.line2")}</span><br />
          <span className="text-white">{t("hero.line3")}</span>
        </h1>

        <p className="text-muted max-w-xl mx-auto mb-6" style={{ fontSize: scr.mobile ? 13 : 16 }}>
          {desc}
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/store" className="btn-primary" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            {ctaStore}
          </Link>
          <Link href="/#plans" className="btn-outline" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            {ctaPlans}
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          {[t("hero.trust1"), t("hero.trust2"), t("hero.trust3"), t("hero.trust4")].map((b) => (
            <span key={b} className="text-dim text-[12px] glass-elevated px-3 py-1.5 rounded-full">{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Stats Strip =====
export function StatsStrip({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const cmsItems = cms?.content?.items;
  const stats = cmsItems?.length ? cmsItems.map((item: any) => ({
    value: item.value,
    label: lang === "he" ? (item.label_he || item.label_ar) : (item.label_ar || item.label_he),
    icon: item.icon,
  })) : [
    { value: "500+", label: t("stats.customers"), icon: "👥" },
    { value: "50+", label: t("stats.products"), icon: "📱" },
    { value: "24h", label: t("stats.delivery"), icon: "🚚" },
    { value: "100%", label: t("stats.guarantee"), icon: "✅" },
  ];

  return (
    <section className="glass-card-static border-0">
      <div className="max-w-6xl mx-auto grid gap-0" style={{
        gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
        padding: scr.mobile ? "16px" : "24px",
      }}>
        {stats.map((s: { value: string; label: string; icon: string }) => (
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
  const { t } = useLang();

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
    <section id="plans" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>{t("plans.title")}</h2>
          <p className="text-muted mt-1" style={{ fontSize: scr.mobile ? 11 : 14 }}>{t("plans.subtitle")}</p>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : plans.length >= 4 ? "1fr 1fr 1fr 1fr" : `repeat(${plans.length}, 1fr)` }}>
          {plans.map((l) => (
            <div key={l.id} className={`${l.popular ? "glass-brand-glow" : "glass-card-static"} relative text-center transition-all`} style={{
              padding: scr.mobile ? 16 : 24,
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

// ===== Features Section =====
export function FeaturesSection({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const cmsItems = cms?.content?.items;
  const features = cmsItems?.length ? cmsItems.map((item: any) => ({
    icon: item.icon,
    title: lang === "he" ? (item.title_he || item.title_ar) : (item.title_ar || item.title_he),
    desc: lang === "he" ? (item.desc_he || item.desc_ar) : (item.desc_ar || item.desc_he),
  })) : [
    { icon: "🏪", title: t("features.agent"), desc: t("features.agentDesc") },
    { icon: "🚚", title: t("features.delivery"), desc: t("features.deliveryDesc") },
    { icon: "💳", title: t("features.installments"), desc: t("features.installmentsDesc") },
    { icon: "📱", title: t("features.latest"), desc: t("features.latestDesc") },
    { icon: "🔒", title: t("features.secure"), desc: t("features.secureDesc") },
    { icon: "💬", title: t("features.support"), desc: t("features.supportDesc") },
  ];

  return (
    <section style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>{t("features.title")}</h2>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
          {features.map((f: { icon: string; title: string; desc: string }) => (
            <div key={f.title} className="glass-card text-center" style={{ padding: scr.mobile ? 16 : 24 }}>
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
export function FAQSection({ faqs, cms }: { faqs?: { q: string; a: string }[]; cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const cmsItems = cms?.content?.items;
  const defaultFaqs = cmsItems?.length ? cmsItems.map((item: any) => ({
    q: lang === "he" ? (item.q_he || item.q_ar) : (item.q_ar || item.q_he),
    a: lang === "he" ? (item.a_he || item.a_ar) : (item.a_ar || item.a_he),
  })) : (faqs || [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
  ]);

  return (
    <section id="faq" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-black" style={{ fontSize: scr.mobile ? 20 : 32 }}>{t("faq.title")}</h2>
        </div>
        <div className="space-y-1.5" role="list">
          {defaultFaqs.map((f: { q: string; a: string }, i: number) => (
            <div key={i} className="glass-card-static" style={{ padding: scr.mobile ? "12px 14px" : "16px 20px" }}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between cursor-pointer bg-transparent border-0 p-0 text-white"
                aria-expanded={openIdx === i}
                aria-controls={`faq-${i}`}
              >
                <span className="text-brand transition-transform" style={{ transform: openIdx === i ? "rotate(45deg)" : "rotate(0)", fontSize: 16 }}>+</span>
                <span className="font-bold text-right flex-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>{f.q}</span>
              </button>
              {openIdx === i && (
                <div id={`faq-${i}`} className="text-muted text-right mt-2 leading-relaxed" style={{ fontSize: scr.mobile ? 11 : 13 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== CTA Section =====
export function CTASection({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t, lang } = useLang();
  const c = cms?.content || {};
  const title = lang === "he" ? (c.title_he || t("cta.title")) : (c.title_ar || t("cta.title"));
  const desc = lang === "he" ? (c.desc_he || t("cta.desc")) : (c.desc_ar || t("cta.desc"));
  const btn1 = lang === "he" ? (c.btn1_he || t("cta.store")) : (c.btn1_ar || t("cta.store"));
  const btn2 = lang === "he" ? (c.btn2_he || t("cta.contact")) : (c.btn2_ar || t("cta.contact"));
  const btn1Link = c.btn1_link || "/store";
  const btn2Link = c.btn2_link || "/contact";

  return (
    <section className="relative overflow-hidden" style={{ padding: scr.mobile ? "32px 16px" : "64px 24px" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(196,16,64,0.12) 0%, transparent 70%)",
      }} />
      <div className="glass-card-static max-w-3xl mx-auto text-center relative z-10 p-8 md:p-12">
        <h2 className="font-black mb-2" style={{ fontSize: scr.mobile ? 20 : 32 }}>{title}</h2>
        <p className="text-muted mb-5" style={{ fontSize: scr.mobile ? 12 : 15 }}>
          {desc}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href={btn1Link} className="btn-primary" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            {btn1}
          </Link>
          <Link href={btn2Link} className="btn-outline" style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "12px 24px" : "14px 36px" }}>
            {btn2}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ===== Footer =====
export function Footer({ cms }: { cms?: WebsiteContent }) {
  const scr = useScreen();
  const { t } = useLang();
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
    <footer className="glass-bottom-bar">
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
        <div className="border-t border-glass-border mt-6 pt-4 flex items-center justify-between">
          <Link href="/privacy" className="text-dim text-[11px] hover:text-muted">{t("footer.privacy")}</Link>
          <span className="text-dim text-[11px]">© {year} ClalMobile. {t("footer.rights")}.</span>
        </div>
      </div>
    </footer>
  );
}
