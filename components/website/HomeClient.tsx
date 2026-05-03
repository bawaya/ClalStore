"use client";

import { Navbar, HeroSection, StatsStrip, FeaturedProducts, LinePlansSection, FeaturesSection, FAQSection, CTASection, Footer } from "./sections";
import BrandStrip from "@/components/website/BrandStrip";
import CategoriesStrip from "@/components/website/CategoriesStrip";
import type { WebsiteContent } from "@/types/database";

// StickyCartBar + WebChatWidget are now mounted globally in app/layout.tsx via PublicChrome.
// Do NOT re-mount them here — would cause double-mount + paddingTop tug-of-war.
export function HomeClient({ products, plans, cms }: { products: any[]; plans: any[]; cms?: Record<string, WebsiteContent> }) {
  return (
    <div dir="rtl" className="font-arabic bg-[#070709] text-white min-h-screen">
      <Navbar />
      <HeroSection cms={cms?.hero} />
      <StatsStrip cms={cms?.stats} />
      <BrandStrip />
      <CategoriesStrip />
      {products.length > 0 && <FeaturedProducts products={products} />}
      {plans.length > 0 && <LinePlansSection plans={plans} />}
      <FeaturesSection cms={cms?.features} />
      <FAQSection cms={cms?.faq} />
      <CTASection cms={cms?.cta} />
      <Footer cms={cms?.footer} />
    </div>
  );
}
