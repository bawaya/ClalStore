"use client";

// =====================================================
// Cookie consent banner — Israeli Privacy Protection Law
// Amendment 13 (effective Aug 14, 2025).
//
// Required by law:
//  • Active opt-in (no implied consent)
//  • "Reject All" button equally prominent as "Accept All"
//  • Granular categories (essential / functional / analytics / advertising)
//  • Tracking scripts MUST NOT load before consent
//  • Re-openable from footer ("manage cookies")
// =====================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import {
  readConsent,
  writeConsent,
  logConsentToServer,
  PRIVACY_VERSION,
  type ConsentState,
} from "@/lib/consent";

type Mode = "hidden" | "banner" | "customize";

const REOPEN_EVENT = "clal-consent-reopen";

/** Public helper: footer link calls this to reopen the banner. */
export function reopenCookieConsent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
  }
}

export function CookieConsent() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const [mode, setMode] = useState<Mode>("hidden");
  const [prefs, setPrefs] = useState({ functional: false, analytics: false, advertising: false });

  useEffect(() => {
    // First-visit check
    const existing = readConsent();
    if (!existing) {
      const tm = setTimeout(() => setMode("banner"), 600);
      return () => clearTimeout(tm);
    } else {
      // Pre-load existing prefs into the customize panel for re-opening
      setPrefs({
        functional: existing.functional,
        analytics: existing.analytics,
        advertising: existing.advertising,
      });
    }
  }, []);

  // Listen for footer "manage cookies" click
  useEffect(() => {
    const handler = () => {
      const existing = readConsent();
      if (existing) {
        setPrefs({
          functional: existing.functional,
          analytics: existing.analytics,
          advertising: existing.advertising,
        });
      }
      setMode("customize");
    };
    window.addEventListener(REOPEN_EVENT, handler);
    return () => window.removeEventListener(REOPEN_EVENT, handler);
  }, []);

  const persist = useCallback(
    (next: { functional: boolean; analytics: boolean; advertising: boolean }) => {
      writeConsent(next);
      const state: ConsentState = {
        essential: true,
        functional: next.functional,
        analytics: next.analytics,
        advertising: next.advertising,
        version: PRIVACY_VERSION,
        updated_at: new Date().toISOString(),
      };
      void logConsentToServer(state, "cookie_banner");
      setMode("hidden");
    },
    [],
  );

  const acceptAll = () => persist({ functional: true, analytics: true, advertising: true });
  const rejectAll = () => persist({ functional: false, analytics: false, advertising: false });
  const saveCustom = () => persist(prefs);

  if (mode === "hidden") return null;

  // ─────────────────── Banner (initial) ───────────────────
  if (mode === "banner") {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-[9998] bg-surface-card border-t-2 border-brand"
        dir={lang === "he" ? "rtl" : "rtl"}
        style={{
          padding: scr.mobile ? "14px 16px" : "20px 28px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
        }}
        role="dialog"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-desc"
      >
        <div className="max-w-5xl mx-auto">
          <h2 id="cookie-consent-title" className="font-black text-white mb-1.5" style={{ fontSize: scr.mobile ? 14 : 17 }}>
            🍪 {t("cookie.title")}
          </h2>
          <p
            id="cookie-consent-desc"
            className="text-muted leading-relaxed mb-3"
            style={{ fontSize: scr.mobile ? 11 : 13 }}
          >
            {t("cookie.body")}{" "}
            <Link href="/privacy" className="text-brand underline hover:text-white">
              {t("cookie.policyLink")}
            </Link>
          </p>
          {/* Three buttons of equal visual weight — Amendment 13 requires it */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={rejectAll}
              className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold cursor-pointer hover:border-brand/40 transition-colors"
              style={{ padding: scr.mobile ? "10px" : "12px", fontSize: scr.mobile ? 13 : 14 }}
            >
              ❌ {t("cookie.rejectAll")}
            </button>
            <button
              type="button"
              onClick={() => setMode("customize")}
              className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold cursor-pointer hover:border-brand/40 transition-colors"
              style={{ padding: scr.mobile ? "10px" : "12px", fontSize: scr.mobile ? 13 : 14 }}
            >
              ⚙️ {t("cookie.customize")}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-xl border-2 border-brand bg-brand text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
              style={{ padding: scr.mobile ? "10px" : "12px", fontSize: scr.mobile ? 13 : 14 }}
            >
              ✅ {t("cookie.acceptAll")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────── Customize modal ───────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/70"
      dir="rtl"
      role="dialog"
      aria-labelledby="cookie-customize-title"
    >
      <div
        className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ padding: scr.mobile ? 16 : 24 }}
      >
        <h2 id="cookie-customize-title" className="font-black text-white mb-2" style={{ fontSize: scr.mobile ? 16 : 20 }}>
          ⚙️ {t("cookie.customizeTitle")}
        </h2>
        <p className="text-muted mb-4 leading-relaxed" style={{ fontSize: scr.mobile ? 11 : 12 }}>
          {t("cookie.customizeIntro")}
        </p>

        <CategoryRow
          label={t("cookie.cat.essential")}
          desc={t("cookie.cat.essentialDesc")}
          icon="🔒"
          value={true}
          locked
        />
        <CategoryRow
          label={t("cookie.cat.functional")}
          desc={t("cookie.cat.functionalDesc")}
          icon="⚙️"
          value={prefs.functional}
          onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
        />
        <CategoryRow
          label={t("cookie.cat.analytics")}
          desc={t("cookie.cat.analyticsDesc")}
          icon="📊"
          value={prefs.analytics}
          onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
        />
        <CategoryRow
          label={t("cookie.cat.advertising")}
          desc={t("cookie.cat.advertisingDesc")}
          icon="📣"
          value={prefs.advertising}
          onChange={(v) => setPrefs((p) => ({ ...p, advertising: v }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
          <button
            type="button"
            onClick={rejectAll}
            className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold cursor-pointer"
            style={{ padding: "12px", fontSize: 13 }}
          >
            ❌ {t("cookie.rejectAll")}
          </button>
          <button
            type="button"
            onClick={saveCustom}
            className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold cursor-pointer"
            style={{ padding: "12px", fontSize: 13 }}
          >
            💾 {t("cookie.saveChoices")}
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-xl border-2 border-brand bg-brand text-white font-bold cursor-pointer"
            style={{ padding: "12px", fontSize: 13 }}
          >
            ✅ {t("cookie.acceptAll")}
          </button>
        </div>

        <Link
          href="/privacy"
          className="block text-center text-brand text-xs mt-4 underline"
          onClick={() => setMode("hidden")}
        >
          {t("cookie.policyLink")}
        </Link>
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  desc,
  icon,
  value,
  onChange,
  locked,
}: {
  label: string;
  desc: string;
  icon: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-surface-border">
      <button
        type="button"
        onClick={() => !locked && onChange?.(!value)}
        disabled={locked}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed"
        style={{
          background: value ? "#c41040" : "#3f3f46",
          opacity: locked ? 0.6 : 1,
        }}
        aria-checked={value}
        role="switch"
        aria-label={label}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform"
          style={{ transform: value ? "translateX(-22px)" : "translateX(-2px)" }}
        />
      </button>
      <div className="flex-1 text-right">
        <div className="font-bold text-white text-sm flex items-center gap-1.5 justify-end">
          {label} <span>{icon}</span>
        </div>
        <p className="text-muted text-[11px] leading-relaxed mt-0.5">{desc}</p>
        {locked && <span className="text-[10px] text-state-info">🔒 חובה / إجباري</span>}
      </div>
    </div>
  );
}
