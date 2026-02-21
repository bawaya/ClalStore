"use client";

import { Navbar, HeroSection, StatsStrip, FeaturedProducts, LinePlansSection, FeaturesSection, FAQSection, CTASection, Footer } from "./sections";
import { WebChatWidget } from "@/components/chat/WebChatWidget";
import type { WebsiteContent } from "@/types/database";

export function HomeClient({ products, plans, cms }: { products: any[]; plans: any[]; cms?: Record<string, WebsiteContent> }) {
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <HeroSection cms={cms?.hero} />
      <StatsStrip cms={cms?.stats} />
      {products.length > 0 && <FeaturedProducts products={products} />}
      {plans.length > 0 && <LinePlansSection plans={plans} />}
      <FeaturesSection cms={cms?.features} />
      <FAQSection cms={cms?.faq} />
      <CTASection cms={cms?.cta} />
      <Footer cms={cms?.footer} />
      <WebChatWidget />
    </div>
  );
}
