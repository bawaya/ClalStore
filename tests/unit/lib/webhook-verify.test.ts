import { describe, it, expect } from "vitest";
import { verifyWebhookSignature, verifyTwilioSignature } from "@/lib/webhook-verify";

// Helper: compute HMAC-SHA256 hex for testing
async function computeHmacHex(body: string, secret: string, algo: "SHA-256" | "SHA-1" = "SHA-256"): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algo },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper: compute HMAC-SHA1 base64 for Twilio testing
async function computeHmacBase64(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ─────────────────────────────────────────────
// verifyWebhookSignature
// ─────────────────────────────────────────────
describe("verifyWebhookSignature", () => {
  const secret = "webhook-secret-key";
  const body = '{"event":"order.created"}';

  it("returns true for valid SHA-256 signature", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-256");
    const result = await verifyWebhookSignature(body, sig, secret, "sha256");
    expect(result).toBe(true);
  });

  it("returns true for valid SHA-1 signature", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-1");
    const result = await verifyWebhookSignature(body, sig, secret, "sha1");
    expect(result).toBe(true);
  });

  it("strips sha256= prefix from signature", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-256");
    const result = await verifyWebhookSignature(body, `sha256=${sig}`, secret, "sha256");
    expect(result).toBe(true);
  });

  it("strips sha1= prefix from signature", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-1");
    const result = await verifyWebhookSignature(body, `sha1=${sig}`, secret, "sha1");
    expect(result).toBe(true);
  });

  it("returns false for invalid signature", async () => {
    const result = await verifyWebhookSignature(body, "invalid-signature-hex", secret, "sha256");
    expect(result).toBe(false);
  });

  it("returns false for wrong secret", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-256");
    const result = await verifyWebhookSignature(body, sig, "wrong-secret", "sha256");
    expect(result).toBe(false);
  });

  it("returns false when signature is null", async () => {
    const result = await verifyWebhookSignature(body, null, secret);
    expect(result).toBe(false);
  });

  it("returns false when secret is empty", async () => {
    const result = await verifyWebhookSignature(body, "some-sig", "");
    expect(result).toBe(false);
  });

  it("returns false for tampered body", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-256");
    const result = await verifyWebhookSignature('{"event":"order.deleted"}', sig, secret, "sha256");
    expect(result).toBe(false);
  });

  it("defaults to sha256 algorithm", async () => {
    const sig = await computeHmacHex(body, secret, "SHA-256");
    const result = await verifyWebhookSignature(body, sig, secret);
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────
// verifyTwilioSignature
// ─────────────────────────────────────────────
describe("verifyTwilioSignature", () => {
  const authToken = "twilio-auth-token";
  const url = "https://example.com/api/webhook";
  const params = { Body: "Hello", From: "+1234567890", To: "+0987654321" };

  it("returns true for valid Twilio signature", async () => {
    // Build the data string as Twilio does: URL + sorted params
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) {
      dataString += key + (params as Record<string, string>)[key];
    }

    const sig = await computeHmacBase64(dataString, authToken);
    const result = await verifyTwilioSignature(url, params, sig, authToken);
    expect(result).toBe(true);
  });

  it("returns false for wrong signature", async () => {
    const result = await verifyTwilioSignature(url, params, "wrongbase64sig=", authToken);
    expect(result).toBe(false);
  });

  it("returns false when signature is empty", async () => {
    const result = await verifyTwilioSignature(url, params, "", authToken);
    expect(result).toBe(false);
  });

  it("returns false when authToken is empty", async () => {
    const result = await verifyTwilioSignature(url, params, "somesig", "");
    expect(result).toBe(false);
  });

  it("returns false for tampered URL", async () => {
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) {
      dataString += key + (params as Record<string, string>)[key];
    }
    const sig = await computeHmacBase64(dataString, authToken);

    const result = await verifyTwilioSignature("https://evil.com/api/webhook", params, sig, authToken);
    expect(result).toBe(false);
  });

  it("returns false for tampered params", async () => {
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) {
      dataString += key + (params as Record<string, string>)[key];
    }
    const sig = await computeHmacBase64(dataString, authToken);

    const tamperedParams = { ...params, Body: "Hacked" };
    const result = await verifyTwilioSignature(url, tamperedParams, sig, authToken);
    expect(result).toBe(false);
  });

  it("handles empty params object", async () => {
    const dataString = url; // no params appended
    const sig = await computeHmacBase64(dataString, authToken);
    const result = await verifyTwilioSignature(url, {}, sig, authToken);
    expect(result).toBe(true);
  });
});
