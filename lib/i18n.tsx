"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import ar from "@/locales/ar.json";
import he from "@/locales/he.json";

export type Lang = "ar" | "he";

type TranslationMap = typeof ar;

const translations: Record<Lang, TranslationMap> = { ar, he };

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "rtl";
  fontClass: string;
}

const LangContext = createContext<LangContextType>({
  lang: "ar",
  setLang: () => {},
  t: (k) => k,
  dir: "rtl",
  fontClass: "font-arabic",
});

const STORAGE_KEY = "clal_lang";

/** Detect browser / OS language */
function detectLang(): Lang {
  if (typeof window === "undefined") return "ar";
  // Check stored preference first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ar" || stored === "he") return stored;
  // Detect from browser
  const nav = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
  if (/^he/i.test(nav) || /^iw/i.test(nav)) return "he";
  return "ar"; // default
}

/** Deep key lookup: t("nav.home") → translations[lang].nav.home */
function lookup(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path; // fallback: return key
    }
  }
  return typeof cur === "string" ? cur : path;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    setMounted(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    // Update html attributes
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string) => lookup(translations[lang] as unknown as Record<string, unknown>, key),
    [lang]
  );

  // Both Arabic and Hebrew are RTL
  const dir = "rtl" as const;
  const fontClass = lang === "he" ? "font-hebrew" : "font-arabic";

  // Update html lang on mount
  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = lang;
    }
  }, [lang, mounted]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir, fontClass }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
