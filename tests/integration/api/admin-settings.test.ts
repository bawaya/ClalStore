/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeSetting, makeIntegration } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
const setting = makeSetting({ key: "site_name", value: "ClalMobile" });
const integration = makeIntegration({
  id: "int1",
  type: "payment",
  provider: "rivhit",
  config: { api_key: "sk-test-longkey123", business_id: "12345" },
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

const mockGetAdminSettings = vi.fn().mockResolvedValue({ site_name: "ClalMobile" });
const mockGetIntegrations = vi.fn().mockResolvedValue([integration]);
const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);
const mockUpdateIntegration = vi.fn().mockResolvedValue(undefined);
const mockLogAction = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/admin/queries", () => ({
  getAdminSettings: (...args: any[]) => mockGetAdminSettings(...args),
  getIntegrations: (...args: any[]) => mockGetIntegrations(...args),
  updateSetting: (...args: any[]) => mockUpdateSetting(...args),
  updateIntegration: (...args: any[]) => mockUpdateIntegration(...args),
  logAction: (...args: any[]) => mockLogAction(...args),
}));

// Seed the `integrations` table mock with the test integration row so
// `prepareIntegrationConfigForUpdate` (used by PUT /admin/settings) can find it.
// vi.mock is hoisted to top-level — re-declare the seed row here rather than
// closing over the outer `integration` const which won't be initialised yet.
vi.mock("@/lib/supabase", async () => {
  const { createMockSupabaseClient: makeClient, makeIntegration: makeIntegrationFactory } =
    await import("@/tests/helpers");
  const seed = makeIntegrationFactory({
    id: "int1",
    type: "payment",
    provider: "rivhit",
    config: { api_key: "sk-test-longkey123", business_id: "12345" },
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

import { GET, PUT } from "@/app/api/admin/settings/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin Settings API — /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    mockGetAdminSettings.mockResolvedValue({ site_name: "ClalMobile" });
    mockGetIntegrations.mockResolvedValue([integration]);
  });

  // ─── GET ───────────────────────────────────────
  describe("GET", () => {
    it("returns settings and integrations", async () => {
      const req = createMockRequest({ url: "/api/admin/settings" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.settings).toBeDefined();
      expect(body.integrations).toBeDefined();
    });

    it("masks sensitive config fields", async () => {
      const req = createMockRequest({ url: "/api/admin/settings" });
      const res = await GET(req);
      const body = await res.json();

      const int = body.integrations[0];
      // api_key should be masked (length > 6, so shows mask + last 4)
      expect(int.config.api_key).toContain("••••••••");
      expect(int.config._has_api_key).toBe(true);
      // business_id is not sensitive so should be unmasked
      expect(int.config.business_id).toBe("12345");
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/settings" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on DB error", async () => {
      mockGetAdminSettings.mockRejectedValue(new Error("DB fail"));
      const req = createMockRequest({ url: "/api/admin/settings" });
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── PUT ───────────────────────────────────────
  describe("PUT", () => {
    it("updates a setting", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { type: "setting", key: "site_name", value: "NewName" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      expect(mockUpdateSetting).toHaveBeenCalledWith("site_name", "NewName");
      expect(mockLogAction).toHaveBeenCalled();
    });

    it("updates an integration", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: {
          type: "integration",
          id: "int1",
          updates: { provider: "stripe", config: { api_key: "new-key" } },
        },
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      expect(mockUpdateIntegration).toHaveBeenCalledWith("int1", expect.any(Object));
    });

    it("preserves masked integration values from DB", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: {
          type: "integration",
          id: "int1",
          updates: {
            config: { api_key: "••••••••y123", business_id: "99999" },
          },
        },
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      // The route now fetches the existing integration via the supabase
      // client (prepareIntegrationConfigForUpdate -> getIntegrationByIdWithSecrets)
      // rather than the legacy getIntegrations query helper, so we just
      // assert the masked value did not leak into the persisted update.
      expect(mockUpdateIntegration).toHaveBeenCalled();
      const [, persistedUpdates] = mockUpdateIntegration.mock.calls.at(-1)!;
      expect(persistedUpdates.config?.api_key).not.toContain("••••••••");
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({
        method: "PUT",
        body: { type: "setting", key: "k", value: "v" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on update error", async () => {
      mockUpdateSetting.mockRejectedValue(new Error("update failed"));
      const req = createMockRequest({
        method: "PUT",
        body: { type: "setting", key: "k", value: "v" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(500);
    });
  });
});
