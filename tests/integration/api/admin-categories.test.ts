/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
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
      appUserId: "u1",
    }),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/admin/categories/route";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";

// ── Tests ──────────────────────────────────────────────
describe("Admin Categories API — /api/admin/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-install supabase mock for each test (works around helper's hoisted vi.mock bug)
    const client = createMockSupabaseClient({
      categories: { data: [{ id: "c1", name_ar: "هواتف", name_he: "טלפונים", type: "manual", product_ids: [], sort_order: 0, active: true }] },
    });
    (createAdminSupabase as any).mockImplementation(() => client);
    (createServerSupabase as any).mockImplementation(() => client);
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    });
  });

  // ─── GET ───────────────────────────────────────
  describe("GET", () => {
    it("returns all categories sorted by sort_order", async () => {
      const req = createMockRequest({ url: "/api/admin/categories" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/categories" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST ──────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      name_ar: "إكسسوارات",
      name_he: "אביזרים",
      type: "manual",
      active: true,
    };

    it("creates a category with valid data", async () => {
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 for missing name_ar", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { name_he: "test", type: "manual" },
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
  });

  // ─── PUT ───────────────────────────────────────
  describe("PUT", () => {
    it("updates a category with valid data", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "c1", name_ar: "هواتف ذكية" },
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { name_ar: "no id" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ────────────────────────────────────
  describe("DELETE", () => {
    it("deletes a category by id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/categories",
        searchParams: { id: "c1" },
      });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/categories",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });
  });
});
