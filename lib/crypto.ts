
// =====================================================
// ClalMobile — Crypto Utilities (Web Crypto API)
// Workers-compatible — no Node.js crypto module
// =====================================================

/** SHA-256 hash a string, return hex digest */
export async function hashSHA256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("");
}
