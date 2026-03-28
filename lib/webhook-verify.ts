/**
 * Verify webhook HMAC signature.
 * Supports multiple signature header formats used by different providers.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256"
): Promise<boolean> {
  if (!signature || !secret) return false;

  // Strip common prefixes like "sha256=", "sha1="
  const cleanSig = signature.replace(/^sha\d+=/, "");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm === "sha256" ? "SHA-256" : "SHA-1" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (computed.length !== cleanSig.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ cleanSig.charCodeAt(i);
  }
  return result === 0;
}
