// =====================================================
// Canonical public URL for links, redirects, and webhooks
// Prefer NEXT_PUBLIC_APP_URL; NEXT_PUBLIC_SITE_URL kept for compat.
// =====================================================

/** Strip trailing slash for consistent URL building */
export function getPublicSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://clalmobile.com";
}
