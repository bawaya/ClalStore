/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";
import type { MockSupabaseClient } from "@/tests/helpers/supabase-mock";

// ── Hoisted ref so the mocked withPermission can share the client ──
const hoisted = vi.hoisted(() => ({
  clientRef: { current: null as any },
  user: { id: "u1", email: "admin@test.com", role: "super_admin", appUserId: "app-u1", name: "Admin" },
}));

// ── Mocks ──────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue(hoisted.user),
    withPermission: (_module: string, _action: string, handler: any) => {
      return async (req: any) => {
        return handler(req, hoisted.clientRef.current, hoisted.user);
      };
    },
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET, PUT } from "@/app/api/admin/order/route";

// ── Tests ──────────────────────────────────────────────
describe("Admin Order API — /api/admin/order", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient({
      products: {
        data: [
          { id: "p1", name_ar: "آيفون 15", brand: "Apple", sort_position: 1 },
          { id: "p2", name_ar: "سامسونج S25", brand: "Samsung", sort_position: 2 },
        ],
      },
      audit_log: { data: [] },
    });
    hoisted.clientRef.current = mockClient;
  });

  describe("GET", () => {
    it("returns products with selected fields", async () => {
      const req = createMockRequest({ url: "/api/admin/order" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.products).toBeDefined();
    });

    it("calls from('products') with select", async () => {
      const req = createMockRequest({ url: "/api/admin/order" });
      await GET(req);

      expect(mockClient.from).toHaveBeenCalledWith("products");
    });
  });

  describe("PUT", () => {
    it("reorders products with valid orderedIds", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { orderedIds: ["p2", "p1"] },
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when orderedIds is empty", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { orderedIds: [] },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when orderedIds is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: {},
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });
  });
});
