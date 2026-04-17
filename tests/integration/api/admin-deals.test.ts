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

import { GET, POST, PUT, DELETE } from "@/app/api/admin/deals/route";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";

// ── Tests ──────────────────────────────────────────────
describe("Admin Deals API — /api/admin/deals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = createMockSupabaseClient({
      deals: { data: [{ id: "d1", title_ar: "عرض خاص", active: true, sort_order: 0 }] },
      settings: { data: [{ key: "feature_deals", value: "true" }] },
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
    it("returns all deals for admin", async () => {
      const req = createMockRequest({
        url: "/api/admin/deals",
        searchParams: { admin: "true" },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.deals).toBeDefined();
    });

    it("returns public deals when admin=false", async () => {
      const req = createMockRequest({ url: "/api/admin/deals" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 401 for admin mode when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({
        url: "/api/admin/deals",
        searchParams: { admin: "true" },
      });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST ──────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      title_ar: "عرض جديد",
      title_he: "מבצע חדש",
      active: true,
    };

    it("creates a deal with valid data", async () => {
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 for missing title_ar", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { title_he: "test" },
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
    it("updates a deal with valid data", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "d1", title_ar: "عرض محدث" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { title_ar: "no id" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ────────────────────────────────────
  describe("DELETE", () => {
    it("deletes a deal by id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/deals",
        searchParams: { id: "d1" },
      });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/deals",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });
  });
});
