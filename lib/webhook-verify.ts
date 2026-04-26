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

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeSvixSecret(secret: string): ArrayBuffer {
  const raw = secret.replace(/^whsec_/, "").trim();
  try {
    const decoded = atob(raw);
    return toArrayBuffer(Uint8Array.from(decoded, (char) => char.charCodeAt(0)));
  } catch {
    return toArrayBuffer(new TextEncoder().encode(secret));
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Verify Resend/Svix webhook signature headers.
 * Resend signs webhooks with Svix and sends:
 * svix-id, svix-timestamp, svix-signature
 */
export async function verifyResendWebhookSignature(
  rawBody: string,
  headers: {
    id?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  },
  secret: string,
  toleranceSeconds = 300
): Promise<boolean> {
  const id = headers.id?.trim();
  const timestamp = headers.timestamp?.trim();
  const signatureHeader = headers.signature?.trim();

  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsedTimestamp) > toleranceSeconds) return false;

  const payload = `${id}.${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    decodeSvixSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = toBase64(new Uint8Array(signature));
  const candidates = signatureHeader
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [, value = ""] = entry.split(",", 2);
      return value.trim();
    })
    .filter(Boolean);

  return candidates.some((candidate) => constantTimeEqual(computed, candidate));
}

/**
 * Verify Twilio webhook signature.
 * Twilio uses HMAC-SHA1 over (URL + sorted POST params), compared as base64.
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): Promise<boolean> {
  if (!signature || !authToken) return false;

  // Build the data string: URL + sorted param keys with values appended
  const sortedKeys = Object.keys(params).sort();
  let dataString = url;
  for (const key of sortedKeys) {
    dataString += key + params[key];
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataString));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Constant-time comparison
  return constantTimeEqual(computed, signature);
}
