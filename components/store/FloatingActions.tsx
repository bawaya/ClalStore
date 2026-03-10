"use client";

import { Phone, MessageCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { BUSINESS } from "@/lib/constants";

export function FloatingActions() {
  const { t } = useLang();

  return (
    <div className="fixed bottom-24 z-50 flex flex-col gap-2" style={{ insetInlineStart: 16 }} dir="ltr">
      <a
        href={`tel:${BUSINESS.phone.replace(/-/g, "")}`}
        className="glass-icon-btn w-12 h-12 rounded-full shadow-glass hover:scale-110 transition-transform text-state-success"
        aria-label={t("store2.callNow")}
        title={t("store2.callNow")}
      >
        <Phone size={20} />
      </a>
      <a
        href={BUSINESS.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="glass-icon-btn w-12 h-12 rounded-full shadow-glass hover:scale-110 transition-transform text-state-success"
        aria-label={t("store2.whatsapp")}
        title={t("store2.whatsapp")}
      >
        <MessageCircle size={20} />
      </a>
    </div>
  );
}
