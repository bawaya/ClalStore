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
import { Menu, X, ShoppingCart, ChevronLeft } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import type { WebsiteContent } from "@/types/database";

// ===== Navbar =====
export function Navbar() {
  const scr = useScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLang();
  const itemCount = useCart((s) => s.getItemCount());
  const total = useCart((s) => s.getTotal());

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/store", label: t("nav.store") },
    { href: "/#plans", label: t("nav.plans") },
    { href: "/about", label: t("nav.about") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <>
      <nav role="navigation" className="fixed top-0 left-0 right-0 z-50 glass-header glass-glow-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between" style={{ padding: scr.mobile ? "10px 16px" : "12px 24px" }}>
          {/* CTA + Lang + Cart */}
          <div className="flex items-center gap-2">
            <Link
              href="/store/cart"
              className={`glass-icon-btn relative ${itemCount > 0 ? "glass-icon-btn-active" : ""}`}
              style={{
                width: scr.mobile ? 34 : 46,
                height: scr.mobile ? 34 : 46,
              }}
            >
              <ShoppingCart size={scr.mobile ? 15 : 20} />
              {itemCount > 0 && (
                <span
                  className="absolute -top-1.5 rounded-full font-black flex items-center justify-center"
                  style={{
                    insetInlineEnd: -6,
                    width: scr.mobile ? 18 : 22,
                    height: scr.mobile ? 18 : 22,
                    fontSize: scr.mobile ? 9 : 11,
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

      {/* Sticky Cart Bar — same as store */}
      {itemCount > 0 && (
        <div className="sticky-cart-bar" style={{ position: "fixed", top: scr.mobile ? 56 : 64, left: 0, right: 0, zIndex: 45 }}>
          <div
            className="max-w-[1200px] mx-auto flex items-center justify-between"
            style={{ padding: scr.mobile ? "8px 14px" : "10px 28px" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={scr.mobile ? 18 : 20} className="text-brand-light" />
                <span
                  className="absolute -top-2 rounded-full font-black flex items-center justify-center"
                  style={{
                    insetInlineEnd: -8,
                    width: 18, height: 18, fontSize: 10,
                    background: "linear-gradient(135deg, #c41040, #ff3366)",
                    color: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }}
                >
                  {itemCount}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white" style={{ fontSize: scr.mobile ? 12 : 14, lineHeight: 1.2 }}>
                  {t("store.cart")}
                  <span className="text-muted font-normal ms-1.5" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                    ({itemCount} {itemCount === 1 ? t("cartBar.item") : t("cartBar.items")})
                  </span>
                </span>
                <span className="font-black text-brand-light" style={{ fontSize: scr.mobile ? 14 : 16, lineHeight: 1.2 }}>
                  ₪{total.toLocaleString()}
                </span>
              </div>
            </div>
            <Link
              href="/store/cart"
              className="flex items-center gap-1.5 rounded-xl font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{
                padding: scr.mobile ? "8px 16px" : "10px 24px",
                fontSize: scr.mobile ? 12 : 14,
                background: "linear-gradient(135deg, #c41040, #ff3366)",
                boxShadow: "0 4px 15px rgba(196,16,64,0.3)",
              }}
            >
              {t("store.checkout")}
              <ChevronLeft size={16} />
            </Link>
          </div>
          <div
            className="absolute bottom-0 left-[15%] right-[15%] h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(196,16,64,0.2), transparent)" }}
          />
        </div>
      )}
    </>
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

        {/* Payment Methods */}
        <div className="border-t border-glass-border mt-6 pt-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-dim text-[10px] font-medium">{t("footer.securePayment")}</span>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {/* Visa */}
              <svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
                <rect width="38" height="24" rx="4" fill="#1A1F71"/>
                <path d="M16.1 16.2h-2.5l1.6-9.4h2.5l-1.6 9.4zM24.5 7c-.5-.2-1.3-.4-2.2-.4-2.4 0-4.1 1.2-4.1 3 0 1.3 1.2 2 2.1 2.5.9.5 1.2.8 1.2 1.2 0 .6-.7 1-1.4 1-.9 0-1.4-.1-2.2-.5l-.3-.1-.3 1.9c.5.2 1.5.4 2.5.4 2.6 0 4.2-1.2 4.2-3.1 0-1-.6-1.8-2-2.5-.8-.4-1.3-.7-1.3-1.1 0-.4.4-.8 1.3-.8.7 0 1.3.1 1.7.3l.2.1.3-1.9zM29.5 6.8h-1.9c-.6 0-1 .2-1.2.7l-3.5 8.7h2.5l.5-1.4h3c.1.3.3 1.4.3 1.4h2.2l-1.9-9.4zm-3 6.1c.2-.5 1-2.6 1-2.6l.3-.9.2.8s.5 2.3.6 2.7h-2.1zM12.3 6.8l-2.4 6.4-.3-1.2c-.4-1.5-1.8-3.1-3.3-3.9l2.1 8h2.6l3.9-9.4h-2.6z" fill="#fff"/>
                <path d="M7.8 6.8H4l0 .2c3 .8 5 2.6 5.9 4.8l-.8-4.3c-.1-.5-.5-.7-1.3-.7z" fill="#F9A533"/>
              </svg>
              {/* Mastercard */}
              <svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
                <rect width="38" height="24" rx="4" fill="#252525"/>
                <circle cx="15" cy="12" r="7" fill="#EB001B"/>
                <circle cx="23" cy="12" r="7" fill="#F79E1B"/>
                <path d="M19 6.8a7 7 0 0 1 2.6 5.2A7 7 0 0 1 19 17.2a7 7 0 0 1-2.6-5.2A7 7 0 0 1 19 6.8z" fill="#FF5F00"/>
              </svg>
              {/* Isracard */}
              <div className="flex items-center justify-center rounded px-1.5" style={{ background: "#0052CC", height: 24, minWidth: 38 }}>
                <span className="text-white font-bold" style={{ fontSize: 7, letterSpacing: 0.3 }}>ISRACARD</span>
              </div>
              {/* Apple Pay */}
              <svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Apple Pay">
                <rect width="38" height="24" rx="4" fill="#000"/>
                <path d="M11.2 8.4c.3-.4.6-1 .5-1.5-.5 0-1.1.3-1.4.7-.3.4-.6 1-.5 1.5.6 0 1.1-.3 1.4-.7zm.5.8c-.8 0-1.5.5-1.8.5-.4 0-1-.5-1.6-.5-.8 0-1.6.5-2 1.3-.9 1.5-.2 3.7.6 5 .4.6.9 1.3 1.5 1.3.6 0 .8-.4 1.6-.4.7 0 .9.4 1.6.4.6 0 1-.7 1.4-1.3.4-.6.6-1.2.6-1.2-1.4-.5-1.6-2.3-.2-3.1-.5-.6-1.1-1-1.7-1zm6.5-.5v6.8h1.1v-2.3h1.6c1.4 0 2.4-1 2.4-2.3s-1-2.2-2.3-2.2h-2.8zm1.1 1h1.3c1 0 1.5.5 1.5 1.3s-.5 1.3-1.5 1.3h-1.3v-2.6zm6.8 5.9c.7 0 1.3-.4 1.6-.9h0v.8h1v-5h-1.1v1.9c0 .9-.6 1.5-1.3 1.5-.7 0-1.1-.4-1.1-1.2v-2.2h-1.1v2.5c0 1.1.5 1.6 1.5 1.6h.5zm4.2.9c.6-1.8 1.1-3.1 2.4-5.8h-1.2l-1 2.8h0l-1-2.8h-1.2l1.8 4.9-.1.3c-.2.4-.4.6-.8.6h-.3v.9h.4c.6 0 .8-.3 1-.9z" fill="#fff"/>
              </svg>
              {/* Google Pay */}
              <svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Google Pay">
                <rect width="38" height="24" rx="4" fill="#fff" stroke="#e5e7eb"/>
                <path d="M18.3 12.2v2.3h-.7V8.5h1.9c.5 0 .9.2 1.2.5.3.3.5.7.5 1.1 0 .5-.2.8-.5 1.1-.3.3-.7.5-1.2.5h-1.2zm0-3v2.3h1.2c.3 0 .6-.1.8-.3.2-.2.3-.5.3-.8 0-.3-.1-.6-.3-.8-.2-.2-.5-.3-.8-.3h-1.2z" fill="#3C4043"/>
                <path d="M23.2 10.2c.5 0 .9.1 1.2.4.3.3.4.6.4 1.1v2.8h-.7v-.6h0c-.3.5-.7.7-1.2.7-.4 0-.8-.1-1.1-.4-.3-.2-.4-.6-.4-.9 0-.4.1-.7.4-.9.3-.2.7-.4 1.2-.4.4 0 .8.1 1 .3v0c0-.3-.1-.5-.3-.7-.2-.2-.4-.3-.7-.3-.4 0-.7.2-.9.5l-.6-.4c.3-.5.8-.7 1.4-.7h.3zm-.9 2.6c0 .2.1.4.3.5.2.1.4.2.6.2.3 0 .6-.1.9-.4.2-.2.4-.5.4-.8-.3-.2-.6-.3-1-.3-.3 0-.6.1-.8.2-.2.2-.4.4-.4.6z" fill="#3C4043"/>
                <path d="M28 10.3l-2.5 5.7h-.7l.9-2-1.6-3.7h.8l1.1 2.8h0l1.1-2.8h.9z" fill="#3C4043"/>
                <path d="M14.8 11.4c0-.2 0-.5-.1-.7h-3v1.4h1.7c-.1.4-.3.7-.6.9v.8h1c.6-.5.9-1.3.9-2.4z" fill="#4285F4"/>
                <path d="M11.7 14.5c.8 0 1.5-.3 2-.8l-1-.8c-.3.2-.6.3-1 .3-.8 0-1.4-.5-1.6-1.2H9.1v.8c.5 1 1.5 1.7 2.6 1.7z" fill="#34A853"/>
                <path d="M10.1 12c-.1-.2-.1-.5-.1-.7s0-.5.1-.7v-.8H9.1c-.2.5-.4 1-.4 1.5s.1 1 .4 1.5l1-.8z" fill="#FBBC04"/>
                <path d="M11.7 9.3c.4 0 .8.2 1.1.5l.8-.8c-.5-.5-1.1-.7-1.9-.7-1.1 0-2.1.7-2.6 1.7l1 .8c.2-.8.8-1.5 1.6-1.5z" fill="#EA4335"/>
              </svg>
              {/* Bit */}
              <div className="flex items-center justify-center rounded px-1.5" style={{ background: "#00D4AA", height: 24, minWidth: 38 }}>
                <span className="text-white font-black" style={{ fontSize: 10 }}>bit</span>
              </div>
              {/* PayPal */}
              <svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PayPal">
                <rect width="38" height="24" rx="4" fill="#fff" stroke="#e5e7eb"/>
                <path d="M24.3 7.3c.6.7.8 1.6.5 2.8-.7 2.8-2.8 3.8-5.5 3.8h-.4c-.3 0-.6.3-.7.6l-.4 2.4-.1.7c0 .2-.2.4-.4.4h-2.2c-.2 0-.3-.2-.3-.4l.1-.4 1-6.3h.2" fill="#009CDE"/>
                <path d="M25.3 10.1c-.7 2.8-2.8 3.8-5.5 3.8h-1.4c-.3 0-.6.3-.7.6l-.7 4.2c0 .2.1.4.3.4h2.2c.3 0 .5-.2.6-.5l0-.1.4-2.8 0-.1c.1-.3.3-.5.6-.5h.4c2.4 0 4.3-.9 4.9-3.6.2-1.1.1-2-.5-2.6" fill="#012169"/>
                <path d="M15.7 7.4c.1-.3.3-.5.6-.6.1 0 .3-.1.4-.1h4.2c.5 0 1 0 1.4.1.1 0 .3.1.4.1.1 0 .3.1.4.2.1 0 .1.1.2.1.6.3.9.8.8 1.5l0 .1c-.7 2.8-2.8 3.8-5.5 3.8h-1.4c-.3 0-.6.3-.7.6l-1.1 7c0 .2.1.3.3.3h2.4l.6-3.8.8-5z" fill="#003087"/>
              </svg>
              {/* UPay */}
              <div className="flex items-center justify-center rounded px-1.5" style={{ background: "#2563EB", height: 24, minWidth: 38 }}>
                <span className="text-white font-bold" style={{ fontSize: 8 }}>UPay</span>
              </div>
              {/* iCredit */}
              <div className="flex items-center justify-center rounded px-1.5" style={{ background: "#16A34A", height: 24, minWidth: 38 }}>
                <span className="text-white font-bold" style={{ fontSize: 7 }}>iCredit</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span className="text-[9px] font-medium" style={{ color: "#22c55e" }}>SSL Secured · PCI-DSS Compliant</span>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-glass-border mt-4 pt-4 flex items-center justify-between">
          <Link href="/privacy" className="text-dim text-[11px] hover:text-muted">{t("footer.privacy")}</Link>
          <span className="text-dim text-[11px]">© {year} ClalMobile. {t("footer.rights")}.</span>
        </div>
      </div>
    </footer>
  );
}
