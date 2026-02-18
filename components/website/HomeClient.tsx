"use client";

import { Navbar, HeroSection, StatsStrip, FeaturedProducts, LinePlansSection, FeaturesSection, FAQSection, CTASection, Footer } from "./sections";
import { WebChatWidget } from "@/components/chat/WebChatWidget";

export function HomeClient({ products, plans }: { products: any[]; plans: any[] }) {
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <HeroSection />
      <StatsStrip />
      {products.length > 0 && <FeaturedProducts products={products} />}
      {plans.length > 0 && <LinePlansSection plans={plans} />}
      <FeaturesSection />
      <FAQSection />
      <CTASection />
      <Footer />
      <WebChatWidget />
    </div>
  );
}
