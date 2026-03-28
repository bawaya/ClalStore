// =====================================================
// ClalMobile — Client-side CSRF token reader
// Reads the csrf_token cookie set by middleware
// =====================================================

"use client";

/** Read the CSRF token from the csrf_token cookie */
export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? match[1] : "";
}

/** Return headers object with the CSRF token included */
export function csrfHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-csrf-token": getCsrfToken(),
    ...extra,
  };
}
