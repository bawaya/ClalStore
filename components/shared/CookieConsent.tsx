"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

const COOKIE_KEY = "clal_cookie_consent";

export function CookieConsent() {
  const scr = useScreen();
  const { t } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't consented yet
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on load
      const t = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] bg-surface-card border-t border-surface-border"
      dir="rtl"
      style={{
        padding: scr.mobile ? "12px 16px" : "16px 24px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p
            className="text-muted leading-relaxed"
            style={{ fontSize: scr.mobile ? 11 : 13 }}
          >
            {t("cookie.text")}
            {" "}
            <Link
              href="/privacy"
              className="text-brand underline hover:text-white"
              style={{ fontSize: scr.mobile ? 10 : 11 }}
            >
              {t("cookie.link")}
            </Link>
          </p>
        </div>
        <button
          onClick={accept}
          className="btn-primary whitespace-nowrap flex-shrink-0"
          style={{
            fontSize: scr.mobile ? 12 : 14,
            padding: scr.mobile ? "8px 20px" : "10px 28px",
          }}
        >
          {t("cookie.accept")}
        </button>
      </div>
    </div>
  );
}
