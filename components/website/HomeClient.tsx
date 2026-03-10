"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Navbar, HeroSection, StatsStrip, FeaturedProducts } from "./sections";
import type { WebsiteContent } from "@/types/database";

const LinePlansSection = dynamic(() => import("./sections").then((m) => ({ default: m.LinePlansSection })), { ssr: true });
const FeaturesSection = dynamic(() => import("./sections").then((m) => ({ default: m.FeaturesSection })), { ssr: true });
const FAQSection = dynamic(() => import("./sections").then((m) => ({ default: m.FAQSection })), { ssr: true });
const CTASection = dynamic(() => import("./sections").then((m) => ({ default: m.CTASection })), { ssr: true });
const Footer = dynamic(() => import("./sections").then((m) => ({ default: m.Footer })), { ssr: true });
const WebChatWidget = dynamic(() => import("@/components/chat/WebChatWidget").then((m) => ({ default: m.WebChatWidget })), { ssr: false });

export function HomeClient({ products, plans, cms }: { products: any[]; plans: any[]; cms?: Record<string, WebsiteContent> }) {
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <HeroSection cms={cms?.hero} />
      <StatsStrip cms={cms?.stats} />
      {products.length > 0 && <FeaturedProducts products={products} />}
      <Suspense fallback={null}>
        {plans.length > 0 && <LinePlansSection plans={plans} />}
        <FeaturesSection cms={cms?.features} />
        <FAQSection cms={cms?.faq} />
        <CTASection cms={cms?.cta} />
        <Footer cms={cms?.footer} />
      </Suspense>
      <WebChatWidget />
    </div>
  );
}
