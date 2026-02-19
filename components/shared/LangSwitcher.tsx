"use client";

import { useLang } from "@/lib/i18n";

export function LangSwitcher({ size = "md" }: { size?: "sm" | "md" }) {
  const { lang, setLang } = useLang();

  const toggle = () => setLang(lang === "ar" ? "he" : "ar");

  const isSmall = size === "sm";

  return (
    <button
      onClick={toggle}
      title={lang === "ar" ? "עברית" : "العربية"}
      className="flex items-center gap-1 rounded-full border border-surface-border bg-surface-elevated hover:bg-surface-card cursor-pointer transition-colors"
      style={{
        padding: isSmall ? "4px 8px" : "5px 12px",
        fontSize: isSmall ? 11 : 13,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      <span style={{ fontSize: isSmall ? 13 : 15 }}>
        {lang === "ar" ? "🇮🇱" : "🇸🇦"}
      </span>
      <span>{lang === "ar" ? "HE" : "ع"}</span>
    </button>
  );
}
