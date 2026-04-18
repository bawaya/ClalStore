// =====================================================
// ClalMobile — Shared CORS helper for commission endpoints
// Extracted from duplicated declarations across routes (audit issue 4.30).
// =====================================================

export const ALLOWED_ORIGINS = (process.env.COMMISSION_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Build CORS headers for a commission endpoint.
 *
 * Behaviour preserved exactly from the original per-route helpers:
 *   - If no origins configured, returns "*" wildcard (some routes expected
 *     this wildcard fallback; others returned an empty object). Pass
 *     `wildcardWhenUnset=false` to match the "return {}" variant.
 *   - Otherwise, echoes the incoming origin if it is in the allowlist,
 *     falling back to the first allowed origin.
 */
export function corsHeaders(
  origin?: string | null,
  options?: { methods?: string; wildcardWhenUnset?: boolean },
): Record<string, string> {
  const methods = options?.methods ?? "GET, OPTIONS";
  const wildcardWhenUnset = options?.wildcardWhenUnset ?? false;

  if (ALLOWED_ORIGINS.length === 0) {
    if (!wildcardWhenUnset) return {};
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };
  }

  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
