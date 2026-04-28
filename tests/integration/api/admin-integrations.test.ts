/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeIntegration } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
const integration = makeIntegration({
  id: "int1",
  type: "payment",
  provider: "rivhit",
  config: { api_key: "riv-key-123", business_id: "12345" },
  status: "active",
});

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    }),
  };
});

const mockGetIntegrations = vi.fn().mockResolvedValue([integration]);

vi.mock("@/lib/admin/queries", () => ({
  getIntegrations: (...args: any[]) => mockGetIntegrations(...args),
}));

// Seed the integrations table mock so resolveIntegrationConfigForRequest can
// resolve masked values back to the stored config for the integration test
// route's masked-value assertion. The provider name must match the route's
// expected canonical label "רווחית (Rivhit)" for the payment branch.
vi.mock("@/lib/supabase", async () => {
  const { createMockSupabaseClient: makeClient, makeIntegration: makeIntegrationFactory } =
    await import("@/tests/helpers");
  const seed = makeIntegrationFactory({
    id: "int1",
    type: "payment",
    provider: "רווחית (Rivhit)",
    config: { api_key: "riv-key-123", business_id: "12345", group_private_token: "stored-token" },
    status: "active",
  });
  const client = makeClient({
    integrations: { data: [seed] },
    integration_secrets: { data: [] },
  });
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

// Mock global fetch for integration test calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/admin/integrations/test/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin Integrations Test API — /api/admin/integrations/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    mockGetIntegrations.mockResolvedValue([integration]);
  });

  describe("POST", () => {
    it("tests payment integration (rivhit) successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        // Rivhit considers the request successful when Status is 0 or a URL
        // is returned in the response body.
        json: async () => ({ Status: 0, URL: "https://pay.test" }),
      });

      const req = createMockRequest({
        method: "POST",
        body: {
          type: "payment",
          // Route reads `group_private_token` (not `api_key`) for the iCredit
          // (Rivhit) connection test.
          config: { group_private_token: "riv-token-123", business_id: "12345" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.ok).toBe(true);
    });

    it("tests email integration (sendgrid) successfully", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const req = createMockRequest({
        method: "POST",
        body: {
          // The route now requires the explicit provider name to pick the
          // correct upstream call (SendGrid vs Resend).
          type: "email",
          provider: "SendGrid",
          config: { api_key: "SG.test-key" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(true);
    });

    it("tests whatsapp integration (ycloud) successfully", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const req = createMockRequest({
        method: "POST",
        body: {
          type: "whatsapp",
          config: { api_key: "yc-test-key" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(true);
    });

    it("reports failure for invalid credentials (401)", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const req = createMockRequest({
        method: "POST",
        body: {
          type: "email",
          config: { api_key: "invalid-key" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(false);
    });

    it("tests shipping integration (static check)", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          type: "shipping",
          config: { api_key: "ship-key" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(true);
    });

    it("tests analytics integration (static check)", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          type: "analytics",
          config: { tracking_id: "G-TEST123" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(true);
    });

    it("returns 400 when type is missing", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { config: { api_key: "test" } },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when config is missing", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { type: "payment" },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 for unsupported integration type", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          type: "unknown_type",
          config: { api_key: "test" },
        },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("resolves masked config values from DB", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ Status: 0, URL: "https://pay.test" }),
      });

      const req = createMockRequest({
        method: "POST",
        body: {
          type: "payment",
          config: {
            // Send a masked sensitive value alongside non-sensitive fields.
            // The route should use resolveIntegrationConfigForRequest to
            // resolve the masked group_private_token from the seeded DB row
            // and successfully complete the upstream Rivhit call.
            group_private_token: "••••••••oken",
            business_id: "12345",
          },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      // Successful payment test confirms the resolver substituted the masked
      // value (otherwise the route would have failed with a missing-token error).
      expect(body.data.ok).toBe(true);
    });

    it("reports failure for missing api_key in payment", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          type: "payment",
          config: { business_id: "12345" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(false);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({
        method: "POST",
        body: { type: "payment", config: {} },
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("tests SMS integration (twilio) with valid credentials", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "active", friendly_name: "Test Account" }),
      });

      const req = createMockRequest({
        method: "POST",
        body: {
          type: "sms",
          config: {
            account_sid: "AC123",
            auth_token: "auth-token",
            verify_service_sid: "VA123",
          },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(true);
    });

    it("reports failure when twilio credentials are missing", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          type: "sms",
          config: { account_sid: "AC123" },
        },
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.ok).toBe(false);
    });
  });
});
