/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeProduct } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
const product = makeProduct({ id: "p1", name_ar: "آيفون 15" });

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

const mockGetAdminProducts = vi.fn().mockResolvedValue({ data: [product], total: 1 });
const mockCreateProduct = vi.fn().mockResolvedValue(product);
const mockUpdateProduct = vi.fn().mockResolvedValue(product);
const mockDeleteProduct = vi.fn().mockResolvedValue(undefined);
const mockLogAction = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/admin/queries", () => ({
  getAdminProducts: (...args: any[]) => mockGetAdminProducts(...args),
  createProduct: (...args: any[]) => mockCreateProduct(...args),
  updateProduct: (...args: any[]) => mockUpdateProduct(...args),
  deleteProduct: (...args: any[]) => mockDeleteProduct(...args),
  logAction: (...args: any[]) => mockLogAction(...args),
}));

vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/admin/products/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin Products API — /api/admin/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    mockGetAdminProducts.mockResolvedValue({ data: [product], total: 1 });
    mockCreateProduct.mockResolvedValue(product);
    mockUpdateProduct.mockResolvedValue(product);
    mockDeleteProduct.mockResolvedValue(undefined);
  });

  // ─── GET ───────────────────────────────────────
  describe("GET", () => {
    it("returns all products", async () => {
      const req = createMockRequest({ url: "/api/admin/products" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("passes pagination parameters", async () => {
      const req = createMockRequest({
        url: "/api/admin/products",
        searchParams: { limit: "10", offset: "5" },
      });
      await GET(req);

      expect(mockGetAdminProducts).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it("caps limit at 200", async () => {
      const req = createMockRequest({
        url: "/api/admin/products",
        searchParams: { limit: "999" },
      });
      await GET(req);

      expect(mockGetAdminProducts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 200 }),
      );
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/products" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on DB error", async () => {
      mockGetAdminProducts.mockRejectedValue(new Error("DB fail"));
      const req = createMockRequest({ url: "/api/admin/products" });
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST ──────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      name_ar: "آيفون 16",
      name_he: "אייפון 16",
      brand: "Apple",
      type: "device",
      price: 3999,
    };

    it("creates a product with valid data", async () => {
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateProduct).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it("returns 400 for invalid body (missing name_ar)", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { brand: "Apple", type: "device", price: 100 },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on createProduct error", async () => {
      mockCreateProduct.mockRejectedValue(new Error("insert failed"));
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── PUT ───────────────────────────────────────
  describe("PUT", () => {
    it("updates a product with valid data", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "p1", name_ar: "updated" },
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateProduct).toHaveBeenCalledWith("p1", expect.any(Object));
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { name_ar: "no id" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on update error", async () => {
      mockUpdateProduct.mockRejectedValue(new Error("update failed"));
      const req = createMockRequest({
        method: "PUT",
        body: { id: "p1", name_ar: "fail" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── DELETE ────────────────────────────────────
  describe("DELETE", () => {
    it("deletes a product by id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/products",
        searchParams: { id: "p1" },
      });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDeleteProduct).toHaveBeenCalledWith("p1");
    });

    it("bulk deletes products by ids", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/products",
        searchParams: { ids: "p1,p2,p3" },
      });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.deleted).toBe(3);
    });

    it("returns 400 when no id provided", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/products",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when ids list is empty", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/products",
        searchParams: { ids: "" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when ids count exceeds 50", async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `p${i}`).join(",");
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/products",
        searchParams: { ids },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on delete error", async () => {
      mockDeleteProduct.mockRejectedValue(new Error("delete failed"));
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/products",
        searchParams: { id: "p1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(500);
    });
  });
});
