import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/tests/helpers/request-mock";
import { generateCsrfToken, setCsrfCookie, validateCsrf } from "@/lib/csrf";

// ─────────────────────────────────────────────
// generateCsrfToken
// ─────────────────────────────────────────────
describe("generateCsrfToken", () => {
  it("returns a 64-character hex string (32 bytes)", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(20);
  });

  it("only contains lowercase hex characters", () => {
    const token = generateCsrfToken();
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// setCsrfCookie
// ─────────────────────────────────────────────
describe("setCsrfCookie", () => {
  it("sets the csrf_token cookie on the response", () => {
    const setCookieFn = vi.fn();
    const mockResponse = {
      cookies: { set: setCookieFn },
    } as any;

    setCsrfCookie(mockResponse, "test-token-abc123");

    expect(setCookieFn).toHaveBeenCalledWith(
      "csrf_token",
      "test-token-abc123",
      expect.objectContaining({
        httpOnly: false,
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      }),
    );
  });

  it("sets secure to true in production", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    const setCookieFn = vi.fn();
    const mockResponse = { cookies: { set: setCookieFn } } as any;

    setCsrfCookie(mockResponse, "token");

    expect(setCookieFn).toHaveBeenCalledWith(
      "csrf_token",
      "token",
      expect.objectContaining({ secure: true }),
    );

    (process.env as any).NODE_ENV = originalEnv;
  });

  it("sets secure to false in development", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "development";

    const setCookieFn = vi.fn();
    const mockResponse = { cookies: { set: setCookieFn } } as any;

    setCsrfCookie(mockResponse, "token");

    expect(setCookieFn).toHaveBeenCalledWith(
      "csrf_token",
      "token",
      expect.objectContaining({ secure: false }),
    );

    (process.env as any).NODE_ENV = originalEnv;
  });
});

// ─────────────────────────────────────────────
// validateCsrf
// ─────────────────────────────────────────────
describe("validateCsrf", () => {
  it("returns true when cookie and header tokens match", () => {
    const token = generateCsrfToken();
    const req = createMockRequest({
      cookies: { csrf_token: token },
      headers: { "x-csrf-token": token },
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it("returns false when cookie token is missing", () => {
    const req = createMockRequest({
      cookies: {},
      headers: { "x-csrf-token": "some-token" },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it("returns false when header token is missing", () => {
    const req = createMockRequest({
      cookies: { csrf_token: "some-token" },
      headers: {},
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it("returns false when tokens do not match", () => {
    const req = createMockRequest({
      cookies: { csrf_token: "aaaa" + "0".repeat(60) },
      headers: { "x-csrf-token": "bbbb" + "0".repeat(60) },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it("returns false when both tokens are missing", () => {
    const req = createMockRequest({ cookies: {}, headers: {} });
    expect(validateCsrf(req)).toBe(false);
  });

  it("returns false when tokens have different lengths", () => {
    const req = createMockRequest({
      cookies: { csrf_token: "short" },
      headers: { "x-csrf-token": "muchlongertoken" },
    });
    expect(validateCsrf(req)).toBe(false);
  });
});
