// =====================================================
// Consent state — Amendment 13 compliant
// 4 categories: essential | functional | analytics | advertising
// Persisted in localStorage AND (when authenticated) in DB
// =====================================================

export type ConsentCategory = "essential" | "functional" | "analytics" | "advertising";

export interface ConsentState {
  essential: true;            // always true (cart, login, CSRF, language)
  functional: boolean;        // remembers preferences
  analytics: boolean;         // GA4
  advertising: boolean;       // Meta Pixel
  /** Privacy policy version the user accepted. Bumping the version forces re-consent. */
  version: string;
  /** ISO timestamp of last update. */
  updated_at: string;
}

/** Bump this when the privacy policy changes materially → users must re-consent. */
export const PRIVACY_VERSION = "2026-04-24";

const STORAGE_KEY = "clal_consent_v2";
const VISITOR_KEY = "clal_visitor_id";

export const DEFAULT_CONSENT: ConsentState = {
  essential: true,
  functional: false,
  analytics: false,
  advertising: false,
  version: PRIVACY_VERSION,
  updated_at: new Date(0).toISOString(),
};

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    // Force re-consent if policy version changed
    if (parsed.version !== PRIVACY_VERSION) return null;
    return { ...DEFAULT_CONSENT, ...parsed, essential: true };
  } catch {
    return null;
  }
}

export function writeConsent(state: Omit<ConsentState, "essential" | "version" | "updated_at">) {
  if (typeof window === "undefined") return;
  const full: ConsentState = {
    ...state,
    essential: true,
    version: PRIVACY_VERSION,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  // Notify listeners (Analytics, etc.)
  window.dispatchEvent(new CustomEvent("clal-consent-changed", { detail: full }));
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/**
 * Persist consent choice to the server audit log (consent_log table).
 * Best-effort: never throws — UI must remain responsive even if DB write fails.
 */
export async function logConsentToServer(
  state: ConsentState,
  source: "cookie_banner" | "account_settings" | "withdraw" = "cookie_banner",
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_id: getOrCreateVisitorId(),
        source,
        functional: state.functional,
        analytics: state.analytics,
        advertising: state.advertising,
        privacy_version: state.version,
      }),
      keepalive: true,
    });
  } catch {
    /* silent — banner already updated locally */
  }
}

/** True if any non-essential category is granted. */
export function hasAnyOptionalConsent(state: ConsentState | null): boolean {
  if (!state) return false;
  return state.functional || state.analytics || state.advertising;
}
