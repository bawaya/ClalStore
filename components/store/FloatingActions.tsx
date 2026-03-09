"use client";

import { BUSINESS } from "@/lib/constants";

export function FloatingActions() {
  return (
    <div className="fixed bottom-20 left-4 z-40 flex flex-col gap-2" dir="ltr">
      <a
        href={`tel:${BUSINESS.phone.replace(/-/g, "")}`}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-state-success shadow-lg hover:scale-110 transition-transform"
        aria-label="اتصل الآن"
        title="اتصل الآن"
      >
        <span className="text-xl">📞</span>
      </a>
      <a
        href={BUSINESS.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-[#25D366] shadow-lg hover:scale-110 transition-transform"
        aria-label="واتساب"
        title="واتساب"
      >
        <span className="text-xl">💬</span>
      </a>
    </div>
  );
}
