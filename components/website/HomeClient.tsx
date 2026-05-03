"use client";

import { Navbar, HeroSection, StatsStrip, FeaturedProducts, LinePlansSection, FeaturesSection, FAQSection, CTASection, Footer } from "./sections";
import { WebChatWidget } from "@/components/chat/WebChatWidget";
import { StickyCartBar } from "@/components/store/StickyCartBar";
import BrandStrip from "@/components/website/BrandStrip";
import CategoriesStrip from "@/components/website/CategoriesStrip";
import type { WebsiteContent } from "@/types/database";

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
      {/* Kept in HomeClient for PR #1; chrome migration deferred to PR #2 */}
      <StickyCartBar variant="top" />
      <WebChatWidget />
    </div>
  );
}
