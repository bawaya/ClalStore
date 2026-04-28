import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { EmailProvider } from "@/lib/integrations/hub";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

// The integrations layer pulls config from Supabase via the secrets vault.
// Default to a Resend "active" integration so the genuine-production test
// has a path to register the real provider; tests that need a different
// state override the mock per scenario via mockResolvedValueOnce.
const integrationMock = vi.hoisted(() => ({
  getIntegrationByTypeWithSecrets: vi.fn(),
}));
vi.mock("@/lib/integrations/secrets", () => integrationMock);

const ENV_KEYS = [
  "MOCK_OUTBOUND",
  "ALLOW_REAL_OUTBOUND",
  "NODE_ENV",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "MAILPIT_SMTP_HOST",
] as const;

beforeEach(() => {
  // Re-import the hub fresh in each test so the lazy-init `initialized` flag
  // doesn't leak between scenarios.
  vi.resetModules();
  for (const k of ENV_KEYS) vi.stubEnv(k, "");
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  integrationMock.getIntegrationByTypeWithSecrets.mockReset();
  // Default: nothing configured in the integrations table.
  integrationMock.getIntegrationByTypeWithSecrets.mockResolvedValue({
    integration: null,
    config: {},
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hub provider registry — Mailpit switching", () => {
  it("registers MailpitProvider when MOCK_OUTBOUND=true", async () => {
    vi.stubEnv("MOCK_OUTBOUND", "true");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    const { getProvider } = await import("@/lib/integrations/hub");
    const email = await getProvider<EmailProvider>("email");

    expect(email).not.toBeNull();
    expect(email?.name).toBe("Mailpit");
  });

  it("registers MailpitProvider in dev environment without escape hatch", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");

    const { getProvider } = await import("@/lib/integrations/hub");
    const email = await getProvider<EmailProvider>("email");

    expect(email?.name).toBe("Mailpit");
  });

  it("registers MailpitProvider when API key looks like a sandbox token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test_sandbox_key");

    const { getProvider } = await import("@/lib/integrations/hub");
    const email = await getProvider<EmailProvider>("email");

    expect(email?.name).toBe("Mailpit");
  });

  it("registers Resend in production with a genuine key (no guard fires)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_genuineProductionKey1234567890");
    // hub.ts calls getIntegrationByTypeWithSecrets multiple times (payment,
    // email, sms, whatsapp) so we route by type instead of using
    // mockResolvedValueOnce.
    integrationMock.getIntegrationByTypeWithSecrets.mockImplementation(
      async (type: string) => {
        if (type === "email") {
          return {
            integration: { status: "active", provider: "Resend", type: "email" },
            config: { api_key: "re_genuineProductionKey1234567890" },
          };
        }
        return { integration: null, config: {} };
      },
    );

    const { getProvider } = await import("@/lib/integrations/hub");
    const email = await getProvider<EmailProvider>("email");

    expect(email?.name).toBe("Resend");
  });

  it("registers MailpitProvider only once — no double registration", async () => {
    vi.stubEnv("MOCK_OUTBOUND", "true");
    vi.stubEnv("NODE_ENV", "production");

    // Call getProvider twice; the registry must keep returning the same
    // Mailpit instance, never a Resend instance.
    const { getProvider } = await import("@/lib/integrations/hub");
    const a = await getProvider<EmailProvider>("email");
    const b = await getProvider<EmailProvider>("email");

    expect(a?.name).toBe("Mailpit");
    expect(a).toBe(b);
  });
});
