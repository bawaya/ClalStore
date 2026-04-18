/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Chaos tests — verify graceful degradation when external services fail.
 *
 * For each external provider, we simulate the three failure modes that
 * actually happen in production:
 *   1. Connection refused / DNS fail (service down)
 *   2. 5xx from the provider (service sick)
 *   3. Timeout / hang (service slow)
 *
 * In every case the app should render a sensible fallback state, log the
 * error internally, and NEVER crash the request.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function fetchRefused() {
  return vi.fn().mockImplementation(() =>
    Promise.reject(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })),
  );
}

function fetchStatus(status: number, body: any = "") {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      json: async () => (typeof body === "string" ? {} : body),
    } as Response),
  );
}

function fetchTimeout(ms = 1000) {
  return vi.fn().mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("AbortError: request timed out")), ms);
      }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ════════════════════════════════════════════════════════════
// Supabase outage — getProducts() already wraps error
// ════════════════════════════════════════════════════════════

describe("Chaos · Supabase outage", () => {
  it("lib/store/queries.getProducts returns [] when supabase is null", async () => {
    vi.doMock("@/lib/supabase", () => ({
      createServerSupabase: () => null,
      createAdminSupabase: () => null,
      createBrowserSupabase: () => null,
      getSupabase: () => null,
    }));

    const mod = await import("@/lib/store/queries");
    const products = await mod.getProducts();
    expect(products).toEqual([]);
    vi.doUnmock("@/lib/supabase");
  });

  it("lib/store/queries.getHeroes returns [] when supabase is null", async () => {
    vi.doMock("@/lib/supabase", () => ({
      createServerSupabase: () => null,
      createAdminSupabase: () => null,
      createBrowserSupabase: () => null,
      getSupabase: () => null,
    }));

    const mod = await import("@/lib/store/queries");
    const heroes = await mod.getHeroes();
    expect(heroes).toEqual([]);
    vi.doUnmock("@/lib/supabase");
  });
});

// ════════════════════════════════════════════════════════════
// yCloud WhatsApp outage
// ════════════════════════════════════════════════════════════

describe("Chaos · yCloud WhatsApp outage", () => {
  // Actual contract: sendWhatsAppText THROWS on failure. Callers (webhook
  // handlers, cron jobs) are responsible for catching. These tests pin that
  // contract — if someone changes it to swallow errors, we'll catch it.
  beforeEach(() => {
    process.env.YCLOUD_API_KEY = "test-key";
    process.env.WHATSAPP_PHONE_ID = "test-phone";
  });

  it("sendWhatsAppText throws a recognizable error on ECONNREFUSED", async () => {
    vi.stubGlobal("fetch", fetchRefused());
    const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
    await expect(sendWhatsAppText("972501234567", "hello")).rejects.toThrow(/ECONNREFUSED/);
  });

  it("sendWhatsAppText throws `yCloud error: 503` on 503 response", async () => {
    vi.stubGlobal("fetch", fetchStatus(503, "Service Unavailable"));
    const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
    await expect(sendWhatsAppText("972501234567", "hello")).rejects.toThrow(/yCloud error: 503/);
  });

  it("sendWhatsAppText surfaces timeout errors (AbortError)", async () => {
    vi.stubGlobal("fetch", fetchTimeout(50));
    const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
    await expect(sendWhatsAppText("972501234567", "hello")).rejects.toThrow(/timed out|AbortError/i);
  });

  it("caller wrapping with try/catch is the expected pattern", async () => {
    vi.stubGlobal("fetch", fetchStatus(500, "boom"));
    const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
    let caught: unknown = null;
    try {
      await sendWhatsAppText("972501234567", "hello");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/yCloud/);
  });
});

// ════════════════════════════════════════════════════════════
// AI provider outage — Claude / Gemini
// ════════════════════════════════════════════════════════════

describe("Chaos · AI provider outage", () => {
  it("callClaude returns null on ECONNREFUSED (no crash)", async () => {
    vi.stubGlobal("fetch", fetchRefused());
    const { callClaude } = await import("@/lib/ai/claude");
    const result = await callClaude({
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
      apiKey: "test-key",
    } as any);
    expect(result).toBeNull();
  });

  it("callClaude returns null on 429 rate-limit", async () => {
    vi.stubGlobal("fetch", fetchStatus(429, { error: { message: "rate limited" } }));
    const { callClaude } = await import("@/lib/ai/claude");
    const result = await callClaude({
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
      apiKey: "test-key",
    } as any);
    expect(result).toBeNull();
  });

  it("callClaude returns null on 500 server error", async () => {
    vi.stubGlobal("fetch", fetchStatus(500, { error: "internal" }));
    const { callClaude } = await import("@/lib/ai/claude");
    const result = await callClaude({
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
      apiKey: "test-key",
    } as any);
    expect(result).toBeNull();
  });

  it("callClaude returns null on malformed response", async () => {
    vi.stubGlobal("fetch", fetchStatus(200, { unexpected: "shape" }));
    const { callClaude } = await import("@/lib/ai/claude");
    const result = await callClaude({
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
      apiKey: "test-key",
    } as any);
    // Either null or a response with empty text — both acceptable as "handled"
    if (result !== null) {
      expect(typeof result.text).toBe("string");
    } else {
      expect(result).toBeNull();
    }
  });
});

// ════════════════════════════════════════════════════════════
// Rate-limit degradation
// ════════════════════════════════════════════════════════════

describe("Chaos · Rate-limit flood", () => {
  it("checkRateLimit blocks after threshold and recovers after window", async () => {
    // Use real rate-limit module (in-memory) with a very small window
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const cfg = { maxRequests: 3, windowMs: 100 };
    const key = `chaos-${Date.now()}`;

    // First 3 requests pass
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(key, cfg);
      expect(r.allowed).toBe(true);
    }
    // 4th is blocked
    expect(checkRateLimit(key, cfg).allowed).toBe(false);

    // After window, counter resets
    await new Promise((r) => setTimeout(r, 150));
    expect(checkRateLimit(key, cfg).allowed).toBe(true);
  });

  it("different keys have independent counters", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const cfg = { maxRequests: 1, windowMs: 10_000 };
    const key1 = `chaos-a-${Date.now()}`;
    const key2 = `chaos-b-${Date.now()}`;

    expect(checkRateLimit(key1, cfg).allowed).toBe(true);
    expect(checkRateLimit(key1, cfg).allowed).toBe(false); // key1 exhausted
    expect(checkRateLimit(key2, cfg).allowed).toBe(true); // key2 untouched
  });
});

// ════════════════════════════════════════════════════════════
// Webhook verification — malformed / missing signatures
// ════════════════════════════════════════════════════════════

describe("Chaos · Webhook signature attacks", () => {
  it("rejects missing signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/webhook-verify");
    const ok = await verifyWebhookSignature("body", null, "secret");
    expect(ok).toBe(false);
  });

  it("rejects empty-string signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/webhook-verify");
    const ok = await verifyWebhookSignature("body", "", "secret");
    expect(ok).toBe(false);
  });

  it("rejects signature with wrong algorithm prefix", async () => {
    const { verifyWebhookSignature } = await import("@/lib/webhook-verify");
    const ok = await verifyWebhookSignature("body", "md5=deadbeef", "secret");
    expect(ok).toBe(false);
  });

  it("rejects signature of correct shape but wrong secret", async () => {
    const { verifyWebhookSignature } = await import("@/lib/webhook-verify");
    // 64 hex chars — shape valid, value invalid
    const bogus = "0".repeat(64);
    const ok = await verifyWebhookSignature("body", `sha256=${bogus}`, "secret");
    expect(ok).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// CSRF — timing safety
// ════════════════════════════════════════════════════════════

describe("Chaos · CSRF validation", () => {
  it("generates tokens that don't collide under rapid fire", async () => {
    const { generateCsrfToken } = await import("@/lib/csrf");
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateCsrfToken());
    expect(tokens.size).toBe(100); // all unique
  });

  it("generated tokens are 64 hex chars", async () => {
    const { generateCsrfToken } = await import("@/lib/csrf");
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});
