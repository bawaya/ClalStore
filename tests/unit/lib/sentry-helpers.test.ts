// =====================================================
// ClalMobile — Sentry helpers tests
// Proves the PII scrubber actually strips the things we promised in
// docs/testing/AGREEMENTS.md §5.3 (Israeli Amendment 13 compliance).
// =====================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  replaysOnErrorSampleRate,
  replaysSessionSampleRate,
  scrubEvent,
  scrubLog,
  sentryDsn,
  tracesSampleRate,
} from "@/lib/sentry-helpers";

describe("sentryDsn()", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the trimmed DSN when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "  https://abc@o1.ingest.us.sentry.io/2  ");
    expect(sentryDsn()).toBe("https://abc@o1.ingest.us.sentry.io/2");
  });

  it("returns undefined for an empty string (so SDK falls back to no-op)", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(sentryDsn()).toBeUndefined();
  });

  it("returns undefined when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(sentryDsn()).toBeUndefined();
  });
});

describe("sample rates", () => {
  beforeEach(() => {
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "");
    vi.stubEnv("SENTRY_REPLAY_SESSION_SAMPLE_RATE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses 0.1 traces in production / 1.0 in dev", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(tracesSampleRate()).toBe(0.1);
    vi.stubEnv("NODE_ENV", "development");
    expect(tracesSampleRate()).toBe(1.0);
  });

  it("respects SENTRY_TRACES_SAMPLE_RATE override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0.5");
    expect(tracesSampleRate()).toBe(0.5);
  });

  it("ignores out-of-range overrides", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "1.5");
    expect(tracesSampleRate()).toBe(0.1);
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "-0.1");
    expect(tracesSampleRate()).toBe(0.1);
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "not-a-number");
    expect(tracesSampleRate()).toBe(0.1);
  });

  it("uses 0.01 session-replay in production / 1.0 in dev", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(replaysSessionSampleRate()).toBe(0.01);
    vi.stubEnv("NODE_ENV", "development");
    expect(replaysSessionSampleRate()).toBe(1.0);
  });

  it("always captures replay on error at 100%", () => {
    expect(replaysOnErrorSampleRate).toBe(1.0);
  });
});

describe("scrubEvent()", () => {
  it("redacts auth-bearing headers", () => {
    const event = {
      request: {
        headers: {
          Cookie: "csrf_token=abc; sb-access-token=xyz",
          authorization: "Bearer secret-token",
          "x-csrf-token": "csrf-123",
          "x-api-key": "api-456",
          "user-agent": "Mozilla/5.0",
        },
      },
    };

    const out = scrubEvent(event);
    expect(out.request.headers.Cookie).toBe("[REDACTED]");
    expect(out.request.headers.authorization).toBe("[REDACTED]");
    expect(out.request.headers["x-csrf-token"]).toBe("[REDACTED]");
    expect(out.request.headers["x-api-key"]).toBe("[REDACTED]");
    // User-agent isn't PII, leave it.
    expect(out.request.headers["user-agent"]).toBe("Mozilla/5.0");
  });

  it("clears cookies and query_string wholesale", () => {
    const event = {
      request: {
        cookies: { sb_session: "long-jwt", csrf_token: "c123" },
        query_string: "?email=x@y.z&phone=+972501234567",
      },
    };
    const out = scrubEvent(event);
    expect(out.request.cookies).toEqual({});
    expect(out.request.query_string).toBe("[REDACTED]");
  });

  it("redacts known PII fields anywhere in request body", () => {
    const event = {
      request: {
        data: {
          customer_phone: "+972501234567",
          customer_name: "محمد",
          package_price: 59,
          nested: {
            email: "test@example.com",
            password: "p@ssw0rd",
            card_number: "4242 4242 4242 4242",
          },
        },
      },
    };
    const out: any = scrubEvent(event);
    expect(out.request.data.customer_phone).toBe("[REDACTED]");
    expect(out.request.data.customer_name).toBe("[REDACTED]");
    // Non-PII fields survive.
    expect(out.request.data.package_price).toBe(59);
    expect(out.request.data.nested.email).toBe("[REDACTED]");
    expect(out.request.data.nested.password).toBe("[REDACTED]");
    expect(out.request.data.nested.card_number).toBe("[REDACTED]");
  });

  it("redacts phone numbers and emails inside free-text values", () => {
    const event = {
      request: {
        data: {
          notes: "Customer at +972 50 123 4567 emailed test@example.com asking for refund",
        },
      },
    };
    const out: any = scrubEvent(event);
    expect(out.request.data.notes).not.toContain("+972");
    expect(out.request.data.notes).not.toContain("test@example.com");
    expect(out.request.data.notes).toContain("[REDACTED_PHONE]");
    expect(out.request.data.notes).toContain("[REDACTED_EMAIL]");
  });

  it("reduces the user object to a bare { id }", () => {
    const event = {
      user: {
        id: "user-uuid-1",
        email: "real@email.com",
        username: "ahmed",
        ip_address: "203.0.113.42",
      },
    };
    const out = scrubEvent(event);
    expect(out.user).toEqual({ id: "user-uuid-1" });
  });

  it("redacts breadcrumb data fields", () => {
    const event = {
      breadcrumbs: [
        { type: "http", category: "fetch", data: { url: "/api/store/order", customer_phone: "+972501234567" } },
        { type: "navigation", category: "navigation", data: { from: "/store", to: "/checkout" } },
      ],
    };
    const out: any = scrubEvent(event);
    expect(out.breadcrumbs[0].data.customer_phone).toBe("[REDACTED]");
    expect(out.breadcrumbs[0].data.url).toBe("/api/store/order");
    expect(out.breadcrumbs[1].data.from).toBe("/store");
  });

  it("redacts extra and contexts", () => {
    const event = {
      extra: { customer_phone: "+972501234567", debug_marker: "x" },
      contexts: { user_input: { email: "x@y.z" } },
    };
    const out: any = scrubEvent(event);
    expect(out.extra.customer_phone).toBe("[REDACTED]");
    expect(out.extra.debug_marker).toBe("x");
    expect(out.contexts.user_input.email).toBe("[REDACTED]");
  });

  it("returns the same reference (caller's type is preserved)", () => {
    const event = { request: { data: { customer_phone: "+972500000000" } } };
    const out = scrubEvent(event);
    expect(out).toBe(event);
  });

  it("handles an empty event without throwing", () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(scrubEvent({})).toEqual({});
  });
});

describe("scrubLog()", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redacts phone numbers and emails inside the message string", () => {
    const log = {
      level: "info",
      message: "Customer +972 50 123 4567 reached out via test@example.com",
      attributes: {},
    };
    const out = scrubLog(log) as typeof log;
    expect(out.message).not.toContain("+972");
    expect(out.message).not.toContain("test@example.com");
    expect(out.message).toContain("[REDACTED_PHONE]");
    expect(out.message).toContain("[REDACTED_EMAIL]");
  });

  it("redacts PII attribute keys (customer_phone, email, etc.)", () => {
    const log = {
      level: "error",
      message: "Order failed",
      attributes: {
        orderId: "ord_123",
        customer_phone: "+972501234567",
        email: "buyer@example.com",
        amount: 199.0,
      },
    };
    const out = scrubLog(log) as typeof log;
    expect(out.attributes.customer_phone).toBe("[REDACTED]");
    expect(out.attributes.email).toBe("[REDACTED]");
    // Non-PII fields survive.
    expect(out.attributes.orderId).toBe("ord_123");
    expect(out.attributes.amount).toBe(199.0);
  });

  it("scrubs fmt-style template strings", () => {
    const log = {
      level: "info",
      message: { template: "Customer +972501234567 placed order", params: [] },
      attributes: {},
    };
    const out = scrubLog(log) as typeof log;
    expect((out.message as { template: string }).template).toContain("[REDACTED_PHONE]");
    expect((out.message as { template: string }).template).not.toContain("+972");
  });

  it("drops debug/trace logs in production", () => {
    expect(scrubLog({ level: "debug", message: "noise" })).toBeNull();
    expect(scrubLog({ level: "trace", message: "noise" })).toBeNull();
    // info / warn / error / fatal are kept
    expect(scrubLog({ level: "info", message: "x" })).not.toBeNull();
    expect(scrubLog({ level: "warn", message: "x" })).not.toBeNull();
    expect(scrubLog({ level: "error", message: "x" })).not.toBeNull();
    expect(scrubLog({ level: "fatal", message: "x" })).not.toBeNull();
  });

  it("keeps debug/trace in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(scrubLog({ level: "debug", message: "useful in dev" })).not.toBeNull();
    expect(scrubLog({ level: "trace", message: "useful in dev" })).not.toBeNull();
  });

  it("returns the same reference when not dropped (caller's type preserved)", () => {
    const log = { level: "info", message: "x", attributes: { ok: 1 } };
    const out = scrubLog(log);
    expect(out).toBe(log);
  });

  it("handles an empty log without throwing", () => {
    expect(() => scrubLog({})).not.toThrow();
    expect(scrubLog({ level: "info" })).not.toBeNull();
  });
});
