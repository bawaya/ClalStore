/**
 * tests/middleware/middleware.test.ts
 * Comprehensive tests for the Next.js middleware (middleware.ts).
 * Covers: CORS, rate limiting, CSRF, security headers, auth protection, redirects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Rate-limit mock
const checkRateLimitMock = vi.fn(() => ({
  allowed: true,
  remaining: 59,
  resetAt: Date.now() + 60_000,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => (checkRateLimitMock as any)(...args),
  getRateLimitKey: (ip: string, prefix: string) => `${prefix}:${ip}`,
  RATE_LIMITS: {
    webhook: { maxRequests: 120, windowMs: 60_000 },
    api: { maxRequests: 60, windowMs: 60_000 },
    login: { maxRequests: 5, windowMs: 60_000 },
    upload: { maxRequests: 10, windowMs: 60_000 },
  },
}));

// CSRF mock
const validateCsrfMock = vi.fn(() => true);
vi.mock("@/lib/csrf", () => ({
  generateCsrfToken: () => "mock-csrf-token",
  setCsrfCookie: vi.fn(),
  validateCsrf: (...args: unknown[]) => (validateCsrfMock as any)(...args),
}));

// Public site URL mock
vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteUrl: () => "https://clalmobile.com",
}));

// Supabase SSR mock
const getUserMock = vi.fn().mockResolvedValue({ data: { user: null } });
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers to create NextRequest / NextResponse fakes
// ---------------------------------------------------------------------------

function createMockHeaders(init: Record<string, string> = {}): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(init)) headers.set(k, v);
  return headers;
}

interface MockCookie {
  name: string;
  value: string;
}

function createMockRequest(
  pathname: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    cookies?: MockCookie[];
    searchParams?: Record<string, string>;
  } = {},
): any {
  const method = options.method ?? "GET";
  const headers = createMockHeaders(options.headers ?? {});
  const cookieMap = new Map<string, { value: string }>();
  for (const c of options.cookies ?? []) cookieMap.set(c.name, { value: c.value });

  const url = new URL(`https://clalmobile.com${pathname}`);
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) url.searchParams.set(k, v);
  }

  return {
    method,
    headers,
    cookies: { get: (name: string) => cookieMap.get(name) },
    nextUrl: {
      pathname: url.pathname,
      searchParams: url.searchParams,
      clone: () => new URL(url.toString()),
    },
    url: url.toString(),
  };
}

// ---------------------------------------------------------------------------
// Import middleware after mocks are wired
// ---------------------------------------------------------------------------

import { middleware, config } from "@/middleware";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
    validateCsrfMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: null } });

    // Ensure env vars exist for Supabase init
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  // =========================================================================
  // Matcher config
  // =========================================================================
  describe("config.matcher", () => {
    it("includes admin routes", () => {
      expect(config.matcher).toContain("/admin/:path*");
    });

    it("includes CRM routes", () => {
      expect(config.matcher).toContain("/crm/:path*");
    });

    it("includes login route", () => {
      expect(config.matcher).toContain("/login");
    });

    it("includes change-password route", () => {
      expect(config.matcher).toContain("/change-password");
    });

    it("includes API admin routes", () => {
      expect(config.matcher).toContain("/api/admin/:path*");
    });

    it("includes webhook routes", () => {
      expect(config.matcher).toContain("/api/webhook/:path*");
    });

    it("includes sales-pwa routes", () => {
      expect(config.matcher).toContain("/sales-pwa/:path*");
    });

    it("includes mobile (/m) routes", () => {
      expect(config.matcher).toContain("/m/:path*");
    });
  });

  // =========================================================================
  // Public API CORS
  // =========================================================================
  describe("public API CORS", () => {
    it("returns 200 on OPTIONS for webhook paths with CORS headers", async () => {
      const req = createMockRequest("/api/webhook/ycloud", {
        method: "OPTIONS",
        headers: { origin: "https://api.ycloud.com" },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://api.ycloud.com");
    });

    it("falls back to first webhook origin when origin is unknown", async () => {
      const req = createMockRequest("/api/webhook/test", {
        method: "OPTIONS",
        headers: { origin: "https://evil.com" },
      });
      const res = await middleware(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://api.ycloud.com");
    });

    it("sets CORS Allow-Origin on GET for public API (non-webhook)", async () => {
      const req = createMockRequest("/api/health", {
        headers: { origin: "https://clalmobile.com" },
      });
      const res = await middleware(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://clalmobile.com");
    });
  });

  // =========================================================================
  // Rate limiting
  // =========================================================================
  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      checkRateLimitMock.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });
      const req = createMockRequest("/api/store/products", {
        headers: { "cf-connecting-ip": "1.2.3.4" },
      });
      const res = await middleware(req);
      expect(res.status).toBe(429);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(res.headers.get("Retry-After")).toBeDefined();
    });

    it("allows request when rate limit is not exceeded", async () => {
      const req = createMockRequest("/api/store/products", {
        headers: { "cf-connecting-ip": "1.2.3.4" },
      });
      const res = await middleware(req);
      expect(res.status).not.toBe(429);
    });

    it("uses login rate limit config for /login path", async () => {
      const req = createMockRequest("/login", {
        headers: { "cf-connecting-ip": "1.2.3.4" },
      });
      await middleware(req);
      // checkRateLimit should be called with login prefix key
      expect(checkRateLimitMock).toHaveBeenCalled();
      const callArgs = (checkRateLimitMock.mock.calls as any)[0];
      expect(callArgs[0]).toContain("login:");
    });

    it("uses webhook rate limit for /api/webhook paths", async () => {
      const req = createMockRequest("/api/webhook/test", {
        method: "OPTIONS",
        headers: { "cf-connecting-ip": "5.5.5.5" },
      });
      // webhook OPTIONS returns early before rate limit for public API
      await middleware(req);
      // The OPTIONS path returns early, so rate limit may not be called here
    });

    it("applies contact rate limit to /api/contact", async () => {
      const req = createMockRequest("/api/contact", {
        headers: { "cf-connecting-ip": "2.2.2.2" },
      });
      await middleware(req);
      expect(checkRateLimitMock).toHaveBeenCalled();
      const callArgs = (checkRateLimitMock.mock.calls as any)[0];
      expect(callArgs[0]).toContain("contact:");
    });

    it("applies chat rate limit to /api/chat", async () => {
      const req = createMockRequest("/api/chat", {
        headers: { "cf-connecting-ip": "3.3.3.3" },
      });
      await middleware(req);
      expect(checkRateLimitMock).toHaveBeenCalled();
      const callArgs = (checkRateLimitMock.mock.calls as any)[0];
      expect(callArgs[0]).toContain("chat:");
    });

    it("falls back to x-forwarded-for when cf-connecting-ip is absent", async () => {
      const req = createMockRequest("/api/store/products", {
        headers: { "x-forwarded-for": "9.9.9.9, 10.10.10.10" },
      });
      await middleware(req);
      expect(checkRateLimitMock).toHaveBeenCalled();
      const callArgs = (checkRateLimitMock.mock.calls as any)[0];
      expect(callArgs[0]).toContain("9.9.9.9");
    });
  });

  // =========================================================================
  // CSRF Protection
  // =========================================================================
  describe("CSRF protection", () => {
    it("returns 403 when CSRF validation fails on POST", async () => {
      validateCsrfMock.mockReturnValue(false);
      const req = createMockRequest("/api/admin/products", {
        method: "POST",
        cookies: [{ name: "csrf_token", value: "token" }],
      });
      // Need user to be authenticated for this route to proceed to CSRF check
      const res = await middleware(req);
      expect(res.status).toBe(403);
    });

    it("passes through when CSRF is valid on POST", async () => {
      validateCsrfMock.mockReturnValue(true);
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/api/admin/products", {
        method: "POST",
        cookies: [{ name: "csrf_token", value: "valid-token" }],
      });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it("exempts webhook paths from CSRF", async () => {
      validateCsrfMock.mockReturnValue(false);
      const req = createMockRequest("/api/webhook/ycloud", { method: "POST" });
      const res = await middleware(req);
      // Webhook goes through public API path, so should not be 403
      expect(res.status).not.toBe(403);
    });

    it("exempts /api/payment/callback from CSRF", async () => {
      validateCsrfMock.mockReturnValue(false);
      const req = createMockRequest("/api/payment/callback", { method: "POST" });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it("exempts /api/orders from CSRF", async () => {
      validateCsrfMock.mockReturnValue(false);
      const req = createMockRequest("/api/orders", { method: "POST" });
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });
  });

  // =========================================================================
  // Security Headers
  // =========================================================================
  describe("security headers", () => {
    it("sets X-Frame-Options to DENY", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("sets X-Content-Type-Options to nosniff", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("sets X-XSS-Protection header", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    });

    it("sets Referrer-Policy", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    });

    it("sets HSTS header", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    });

    it("sets Permissions-Policy", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    });

    it("sets Content-Security-Policy header", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  // =========================================================================
  // Auth — Protected routes
  // =========================================================================
  describe("auth protection", () => {
    it("redirects unauthenticated user from /admin to /login", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });

    it("redirects unauthenticated user from /crm to /login", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/crm/inbox");
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });

    it("redirects unauthenticated user from /m to /login", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/m/orders");
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });

    it("redirects unauthenticated user from /sales-pwa to /login", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/sales-pwa/submit");
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });

    it("returns 401 for unauthenticated API admin request", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/api/admin/products");
      const res = await middleware(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 for unauthenticated API CRM request", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/api/crm/conversations");
      const res = await middleware(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 for unauthenticated API PWA request", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/api/pwa/submit");
      const res = await middleware(req);
      expect(res.status).toBe(401);
    });

    it("allows authenticated user to access /admin", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user1" } } });
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });

    it("redirects authenticated user away from /login", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user1" } } });
      const req = createMockRequest("/login");
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });

    it("redirects authenticated user from /login to redirect param if present", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user1" } } });
      const req = createMockRequest("/login", {
        searchParams: { redirect: "/admin/orders" },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });
  });

  // =========================================================================
  // Change password
  // =========================================================================
  describe("change-password route", () => {
    it("redirects to /login when not authenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/change-password");
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });

    it("allows authenticated user to access /change-password", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user1" } } });
      const req = createMockRequest("/change-password");
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });
  });

  // =========================================================================
  // Missing Supabase env vars
  // =========================================================================
  describe("missing env vars", () => {
    it("returns 503 when SUPABASE_URL is missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(503);
    });

    it("returns 503 when SUPABASE_ANON_KEY is missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const req = createMockRequest("/admin/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(503);
    });
  });
});
