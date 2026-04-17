import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase with a proper thenable builder
vi.mock("@/lib/supabase", () => {
  const mockBuilder: any = {};
  const chainMethods = ["select", "eq", "neq", "order", "limit", "insert", "update", "delete"];
  for (const m of chainMethods) {
    mockBuilder[m] = vi.fn().mockReturnValue(mockBuilder);
  }
  mockBuilder.single = vi.fn().mockResolvedValue({
    data: { config: { api_key: "test-key" }, status: "active" },
    error: null,
  });
  mockBuilder.maybeSingle = vi.fn().mockResolvedValue({
    data: { config: { api_key: "test-key" }, status: "active" },
    error: null,
  });

  return {
    createAdminSupabase: vi.fn(() => ({
      from: vi.fn().mockReturnValue(mockBuilder),
    })),
  };
});

// Mock provider modules — use real classes so `new Provider()` works
vi.mock("@/lib/integrations/rivhit", () => ({
  RivhitProvider: class RivhitProvider { name = "rivhit"; async createCharge() { return { success: true }; } async verifyPayment() { return { verified: true }; } async refund() { return { success: true }; } },
}));
vi.mock("@/lib/integrations/resend", () => ({
  ResendProvider: class ResendProvider { name = "resend"; async send() { return { success: true }; } async sendTemplate() { return { success: true }; } },
}));
vi.mock("@/lib/integrations/sendgrid", () => ({
  SendGridProvider: class SendGridProvider { name = "sendgrid"; async send() { return { success: true }; } async sendTemplate() { return { success: true }; } },
}));
vi.mock("@/lib/integrations/twilio-sms", () => ({
  TwilioSMSProvider: class TwilioSMSProvider { name = "twilio"; async send() { return { success: true }; } },
}));
vi.mock("@/lib/integrations/ycloud-wa", () => ({
  YCloudWhatsAppProvider: class YCloudWhatsAppProvider { name = "ycloud"; async sendText() { return { success: true }; } async sendButtons() { return { success: true }; } async sendTemplate() { return { success: true }; } },
}));

import { registerProvider, getProvider, initializeProviders, getIntegrationConfig } from "@/lib/integrations/hub";

describe("Integration Hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── registerProvider ───────────────────────────────────────────

  describe("registerProvider", () => {
    it("registers and retrieves a provider", async () => {
      const mockAnalytics = { name: "test-analytics" };
      registerProvider("analytics", mockAnalytics);
      const result = await getProvider("analytics");
      expect(result).toEqual(mockAnalytics);
    });

    it("overwrites previously registered provider", async () => {
      registerProvider("analytics", { name: "old" });
      registerProvider("analytics", { name: "new" });
      const result = await getProvider("analytics");
      expect(result).toEqual({ name: "new" });
    });
  });

  // ─── getProvider ────────────────────────────────────────────────

  describe("getProvider", () => {
    it("returns null for unregistered provider", async () => {
      registerProvider("shipping", null);
      const provider = await getProvider("shipping");
      expect(provider).toBeNull();
    });
  });

  // ─── getIntegrationConfig ───────────────────────────────────────

  describe("getIntegrationConfig", () => {
    it("returns an object for any type", async () => {
      const config = await getIntegrationConfig("payment");
      expect(typeof config).toBe("object");
    });
  });

  // ─── initializeProviders ────────────────────────────────────────

  describe("initializeProviders", () => {
    it("does not throw during initialization", async () => {
      await expect(initializeProviders()).resolves.not.toThrow();
    });
  });
});
