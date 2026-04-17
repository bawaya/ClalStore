import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to reset the module's internal store between tests
let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;
let getRateLimitKey: typeof import("@/lib/rate-limit").getRateLimitKey;
let RATE_LIMITS: typeof import("@/lib/rate-limit").RATE_LIMITS;

describe("rate-limit", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/rate-limit");
    checkRateLimit = mod.checkRateLimit;
    getRateLimitKey = mod.getRateLimitKey;
    RATE_LIMITS = mod.RATE_LIMITS;
  });

  // ─────────────────────────────────────────────
  // getRateLimitKey
  // ─────────────────────────────────────────────
  describe("getRateLimitKey", () => {
    it("combines prefix and IP with colon separator", () => {
      expect(getRateLimitKey("192.168.1.1", "api")).toBe("api:192.168.1.1");
    });

    it("handles different prefixes", () => {
      expect(getRateLimitKey("10.0.0.1", "login")).toBe("login:10.0.0.1");
      expect(getRateLimitKey("10.0.0.1", "webhook")).toBe("webhook:10.0.0.1");
    });

    it("handles IPv6 addresses", () => {
      const key = getRateLimitKey("::1", "api");
      expect(key).toBe("api:::1");
    });
  });

  // ─────────────────────────────────────────────
  // RATE_LIMITS config
  // ─────────────────────────────────────────────
  describe("RATE_LIMITS configuration", () => {
    it("defines webhook limits", () => {
      expect(RATE_LIMITS.webhook).toEqual({ maxRequests: 120, windowMs: 60_000 });
    });

    it("defines api limits", () => {
      expect(RATE_LIMITS.api).toEqual({ maxRequests: 60, windowMs: 60_000 });
    });

    it("defines login limits", () => {
      expect(RATE_LIMITS.login).toEqual({ maxRequests: 5, windowMs: 60_000 });
    });

    it("defines upload limits", () => {
      expect(RATE_LIMITS.upload).toEqual({ maxRequests: 10, windowMs: 60_000 });
    });
  });

  // ─────────────────────────────────────────────
  // checkRateLimit
  // ─────────────────────────────────────────────
  describe("checkRateLimit", () => {
    it("allows first request and returns remaining count", () => {
      const result = checkRateLimit("test:ip1", { maxRequests: 5, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
    });

    it("allows requests up to the limit", () => {
      const config = { maxRequests: 3, windowMs: 60_000 };
      const key = "test:ip2";

      const r1 = checkRateLimit(key, config);
      const r2 = checkRateLimit(key, config);
      const r3 = checkRateLimit(key, config);

      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it("blocks requests exceeding the limit", () => {
      const config = { maxRequests: 2, windowMs: 60_000 };
      const key = "test:ip3";

      checkRateLimit(key, config);
      checkRateLimit(key, config);
      const r3 = checkRateLimit(key, config);

      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it("uses separate counters for different keys", () => {
      const config = { maxRequests: 1, windowMs: 60_000 };

      const r1 = checkRateLimit("test:ipA", config);
      const r2 = checkRateLimit("test:ipB", config);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });

    it("resets after the window expires", () => {
      vi.useFakeTimers();
      const config = { maxRequests: 1, windowMs: 1_000 };
      const key = "test:ip4";

      checkRateLimit(key, config);
      const blocked = checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(1_100);

      const allowed = checkRateLimit(key, config);
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(0);

      vi.useRealTimers();
    });

    it("returns the correct resetAt timestamp", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

      const config = { maxRequests: 10, windowMs: 30_000 };
      const result = checkRateLimit("test:ip5", config);

      expect(result.resetAt).toBe(Date.now() + 30_000);

      vi.useRealTimers();
    });

    it("remaining never goes below 0", () => {
      const config = { maxRequests: 1, windowMs: 60_000 };
      const key = "test:ip6";

      checkRateLimit(key, config);
      checkRateLimit(key, config);
      const r3 = checkRateLimit(key, config);
      const r4 = checkRateLimit(key, config);

      expect(r3.remaining).toBe(0);
      expect(r4.remaining).toBe(0);
    });
  });
});
