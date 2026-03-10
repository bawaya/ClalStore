"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

export function LangSwitcher({ size = "md" }: { size?: "sm" | "md" }) {
  const { lang, setLang } = useLang();
  const [animating, setAnimating] = useState(false);

  const toggle = () => {
    setAnimating(true);
    setTimeout(() => {
      setLang(lang === "ar" ? "he" : "ar");
      setAnimating(false);
    }, 200);
  };

  const isSmall = size === "sm";
  const isAr = lang === "ar";

  return (
    <button
      onClick={toggle}
      title={isAr ? "עברית" : "العربية"}
      className="relative glass flex items-center cursor-pointer transition-all duration-300 active:scale-95 border-brand/35"
      style={{
        width: isSmall ? 56 : 68,
        height: isSmall ? 28 : 34,
        borderRadius: 999,
        borderWidth: 1.5,
        padding: 2,
      }}
    >
      {/* Sliding indicator */}
      <span
        className="absolute rounded-full transition-all duration-300 ease-in-out"
        style={{
          width: isSmall ? 22 : 28,
          height: isSmall ? 22 : 28,
          top: 2,
          right: isAr ? 2 : (isSmall ? 30 : 36),
          background: "linear-gradient(135deg, #c41040, #a30d35)",
          boxShadow: "0 2px 8px rgba(196,16,64,0.4)",
          transform: animating ? "scale(0.8)" : "scale(1)",
        }}
      />

      {/* AR label */}
      <span
        className="relative z-10 flex items-center justify-center font-extrabold transition-colors duration-300"
        style={{
          width: isSmall ? 24 : 30,
          height: "100%",
          fontSize: isSmall ? 10 : 12,
          color: !isAr ? "#fff" : "rgba(255,255,255,0.45)",
          fontFamily: "'Tajawal', sans-serif",
        }}
      >
        ع
      </span>

      {/* HE label */}
      <span
        className="relative z-10 flex items-center justify-center font-extrabold transition-colors duration-300"
        style={{
          width: isSmall ? 24 : 30,
          height: "100%",
          fontSize: isSmall ? 10 : 12,
          color: isAr ? "#fff" : "rgba(255,255,255,0.45)",
          fontFamily: "'David Libre', 'Heebo', serif",
        }}
      >
        עב
      </span>
    </button>
  );
}
