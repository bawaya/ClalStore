"use client";

import { useScreen } from "@/lib/hooks";
import { Navbar, FAQSection, Footer } from "@/components/website/sections";

export default function FAQPage() {
  const scr = useScreen();
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <div style={{ paddingTop: scr.mobile ? 80 : 100, paddingInline: scr.mobile ? 16 : 24 }}>
        <FAQSection />
      </div>
      <Footer />
    </div>
  );
}
