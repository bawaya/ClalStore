import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { isOutboundBlocked } from "@/lib/outbound-guard";

// vi.stubEnv handles NODE_ENV correctly (Next.js types it as read-only).
// We unstub everything between tests so each scenario starts clean.

beforeEach(() => {
  // Each test sets the env vars it needs. Stub them all to "" first so a
  // value leaking in from the surrounding shell can't influence the test.
  vi.stubEnv("MOCK_OUTBOUND", "");
  vi.stubEnv("ALLOW_REAL_OUTBOUND", "");
  vi.stubEnv("NODE_ENV", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SENDGRID_API_KEY", "");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "");
  vi.stubEnv("YCLOUD_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isOutboundBlocked — Layer 1 (MOCK_OUTBOUND)", () => {
  it("blocks when MOCK_OUTBOUND=true even in production with real-looking keys", () => {
    vi.stubEnv("MOCK_OUTBOUND", "true");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_REAL_OUTBOUND", "true");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("mock_outbound_flag");
  });

  it("ignores values other than the literal string 'true'", () => {
    vi.stubEnv("MOCK_OUTBOUND", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_REAL_OUTBOUND", "true");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    // MOCK_OUTBOUND="1" is NOT "true", so layer 1 doesn't fire — but the
    // other layers should still let the call through here.
    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(false);
  });
});

describe("isOutboundBlocked — Layer 2 (NODE_ENV / ALLOW_REAL_OUTBOUND)", () => {
  it("blocks dev environment without the escape hatch", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("non_production_no_escape_hatch");
  });

  it("blocks the test environment by default", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("YCLOUD_API_KEY", "yc_realProductionKey1234567890");

    const result = isOutboundBlocked("whatsapp");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("non_production_no_escape_hatch");
  });

  it("blocks when NODE_ENV is the empty string", () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("non_production_no_escape_hatch");
  });

  it("allows non-production when ALLOW_REAL_OUTBOUND=true (escape hatch)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_REAL_OUTBOUND", "true");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(false);
  });
});

describe("isOutboundBlocked — Layer 3 (suspicious API keys)", () => {
  it("blocks when the email key looks like a sandbox token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SENDGRID_API_KEY", "test_abc123");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("suspicious_api_key");
  });

  it("blocks when the SMS account SID is a sandbox token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "sandbox_AC1234");

    const result = isOutboundBlocked("sms");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("suspicious_api_key");
  });

  it("blocks when the WhatsApp key starts with mock_", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YCLOUD_API_KEY", "mock_yc_key");

    const result = isOutboundBlocked("whatsapp");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("suspicious_api_key");
  });

  it("blocks regardless of case (FAKE_xyz still matches fake_)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "FAKE_xyz");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("suspicious_api_key");
  });
});

describe("isOutboundBlocked — happy path (genuine production send)", () => {
  it("allows the call only when all three layers agree", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_genuineProductionKey1234567890");

    const result = isOutboundBlocked("email");
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("checks the SMS keys when channel='sms', not the email keys", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Email key looks suspicious, but we're sending SMS — must not block.
    vi.stubEnv("RESEND_API_KEY", "test_xxx");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_realProductionKey1234567890");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "real_auth_token_value_xyz");

    const result = isOutboundBlocked("sms");
    expect(result.blocked).toBe(false);
  });
});
