/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeCoupon } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
const coupon = makeCoupon({ id: "cp1", code: "SAVE10", type: "percent", value: 10 });

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

const mockGetAdminCoupons = vi.fn().mockResolvedValue([coupon]);
const mockCreateCoupon = vi.fn().mockResolvedValue(coupon);
const mockUpdateCoupon = vi.fn().mockResolvedValue(coupon);
const mockDeleteCoupon = vi.fn().mockResolvedValue(undefined);
const mockLogAction = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/admin/queries", () => ({
  getAdminCoupons: (...args: any[]) => mockGetAdminCoupons(...args),
  createCoupon: (...args: any[]) => mockCreateCoupon(...args),
  updateCoupon: (...args: any[]) => mockUpdateCoupon(...args),
  deleteCoupon: (...args: any[]) => mockDeleteCoupon(...args),
  logAction: (...args: any[]) => mockLogAction(...args),
}));

vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/admin/coupons/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin Coupons API — /api/admin/coupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    mockGetAdminCoupons.mockResolvedValue([coupon]);
    mockCreateCoupon.mockResolvedValue(coupon);
    mockUpdateCoupon.mockResolvedValue(coupon);
  });

  // ─── GET ───────────────────────────────────────
  describe("GET", () => {
    it("returns all coupons", async () => {
      const req = createMockRequest({ url: "/api/admin/coupons" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].code).toBe("SAVE10");
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/coupons" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on query error", async () => {
      mockGetAdminCoupons.mockRejectedValue(new Error("DB fail"));
      const req = createMockRequest({ url: "/api/admin/coupons" });
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST ──────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      code: "WELCOME20",
      type: "percent",
      value: 20,
      min_order: 100,
      max_uses: 50,
    };

    it("creates a coupon with valid data", async () => {
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateCoupon).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it("returns 400 for invalid coupon type", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { code: "BAD", type: "invalid", value: 10 },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing code", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { type: "fixed", value: 50 },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on creation error", async () => {
      mockCreateCoupon.mockRejectedValue(new Error("insert failed"));
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── PUT ───────────────────────────────────────
  describe("PUT", () => {
    it("updates a coupon", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "cp1", value: 15 },
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateCoupon).toHaveBeenCalledWith("cp1", expect.any(Object));
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { value: 25 },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ────────────────────────────────────
  describe("DELETE", () => {
    it("deletes a coupon by id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/coupons",
        searchParams: { id: "cp1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(mockDeleteCoupon).toHaveBeenCalledWith("cp1");
      expect(mockLogAction).toHaveBeenCalled();
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/coupons",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on delete error", async () => {
      mockDeleteCoupon.mockRejectedValue(new Error("delete failed"));
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/coupons",
        searchParams: { id: "cp1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(500);
    });
  });
});
