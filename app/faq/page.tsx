"use client";

import { Navbar, FAQSection, Footer } from "@/components/website/sections";

export default function FAQPage() {
  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <div style={{ paddingTop: 60 }}>
        <FAQSection />
      </div>
      <Footer />
    </div>
  );
}
