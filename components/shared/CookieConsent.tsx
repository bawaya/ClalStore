"use client";

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

export function reopenCookieConsent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
  }
}

export function CookieConsent() {
  const scr = useScreen();
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("hidden");
  const [prefs, setPrefs] = useState({
    functional: false,
    analytics: false,
    advertising: false,
  });

  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      const tm = setTimeout(() => setMode("banner"), 600);
      return () => clearTimeout(tm);
    }

    setPrefs({
      functional: existing.functional,
      analytics: existing.analytics,
      advertising: existing.advertising,
    });
  }, []);

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
    []
  );

  const acceptAll = () =>
    persist({ functional: true, analytics: true, advertising: true });
  const rejectAll = () =>
    persist({ functional: false, analytics: false, advertising: false });
  const saveCustom = () => persist(prefs);

  if (mode === "hidden") return null;

  if (mode === "banner") {
    return (
      <div
        className="fixed bottom-3 left-3 right-3 z-[9998] rounded-[24px] border border-brand/25 bg-surface-card/95 backdrop-blur-xl md:left-1/2 md:right-auto md:w-[min(960px,calc(100vw-32px))] md:-translate-x-1/2"
        dir="rtl"
        style={{
          padding: scr.mobile ? "12px 14px" : "16px 20px",
          boxShadow: "0 18px 50px rgba(0,0,0,0.38)",
        }}
        role="dialog"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-desc"
      >
        <div className="mx-auto grid gap-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-end">
          <div>
            <h2
              id="cookie-consent-title"
              className="mb-1.5 font-black text-white"
              style={{ fontSize: scr.mobile ? 13 : 16 }}
            >
              🍪 {t("cookie.title")}
            </h2>
            <p
              id="cookie-consent-desc"
              className="text-muted leading-relaxed"
              style={{ fontSize: scr.mobile ? 10.5 : 12.5 }}
            >
              {t("cookie.body")}{" "}
              <Link href="/privacy" className="text-brand underline hover:text-white">
                {t("cookie.policyLink")}
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
            <button
              type="button"
              onClick={rejectAll}
              className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold transition-colors hover:border-brand/40"
              style={{
                padding: scr.mobile ? "10px" : "11px",
                fontSize: scr.mobile ? 13 : 13.5,
              }}
            >
              ❌ {t("cookie.rejectAll")}
            </button>
            <button
              type="button"
              onClick={() => setMode("customize")}
              className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold transition-colors hover:border-brand/40"
              style={{
                padding: scr.mobile ? "10px" : "11px",
                fontSize: scr.mobile ? 13 : 13.5,
              }}
            >
              ⚙️ {t("cookie.customize")}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-xl border-2 border-brand bg-brand text-white font-bold transition-opacity hover:opacity-90"
              style={{
                padding: scr.mobile ? "10px" : "11px",
                fontSize: scr.mobile ? 13 : 13.5,
              }}
            >
              ✅ {t("cookie.acceptAll")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3"
      dir="rtl"
      role="dialog"
      aria-labelledby="cookie-customize-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-surface-border bg-surface-card"
        style={{ padding: scr.mobile ? 16 : 24 }}
      >
        <h2
          id="cookie-customize-title"
          className="mb-2 font-black text-white"
          style={{ fontSize: scr.mobile ? 16 : 20 }}
        >
          ⚙️ {t("cookie.customizeTitle")}
        </h2>
        <p
          className="mb-4 text-muted"
          style={{ fontSize: scr.mobile ? 11 : 12, lineHeight: 1.7 }}
        >
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

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={rejectAll}
            className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold"
            style={{ padding: "12px", fontSize: 13 }}
          >
            ❌ {t("cookie.rejectAll")}
          </button>
          <button
            type="button"
            onClick={saveCustom}
            className="rounded-xl border border-surface-border bg-surface-elevated text-white font-bold"
            style={{ padding: "12px", fontSize: 13 }}
          >
            💾 {t("cookie.saveChoices")}
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-xl border-2 border-brand bg-brand text-white font-bold"
            style={{ padding: "12px", fontSize: 13 }}
          >
            ✅ {t("cookie.acceptAll")}
          </button>
        </div>

        <Link
          href="/privacy"
          className="mt-4 block text-center text-xs text-brand underline"
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
    <div className="flex items-start gap-3 border-b border-surface-border py-3">
      <button
        type="button"
        onClick={() => !locked && onChange?.(!value)}
        disabled={locked}
        className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed"
        style={{
          background: value ? "#c41040" : "#3f3f46",
          opacity: locked ? 0.6 : 1,
        }}
        aria-checked={value}
        role="switch"
        aria-label={label}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: value ? "translateX(-22px)" : "translateX(-2px)" }}
        />
      </button>

      <div className="flex-1 text-right">
        <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-white">
          {label} <span>{icon}</span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{desc}</p>
        {locked && (
          <span className="text-[10px] text-state-info">🔒 חובה / إجباري</span>
        )}
      </div>
    </div>
  );
}
