/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeHero } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
const hero = makeHero({ id: "h1", title_ar: "بنر رئيسي" });

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

const mockGetAdminHeroes = vi.fn().mockResolvedValue([hero]);
const mockCreateHero = vi.fn().mockResolvedValue(hero);
const mockUpdateHero = vi.fn().mockResolvedValue(hero);
const mockDeleteHero = vi.fn().mockResolvedValue(undefined);
const mockLogAction = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/admin/queries", () => ({
  getAdminHeroes: (...args: any[]) => mockGetAdminHeroes(...args),
  createHero: (...args: any[]) => mockCreateHero(...args),
  updateHero: (...args: any[]) => mockUpdateHero(...args),
  deleteHero: (...args: any[]) => mockDeleteHero(...args),
  logAction: (...args: any[]) => mockLogAction(...args),
}));

vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/admin/heroes/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin Heroes API — /api/admin/heroes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    mockGetAdminHeroes.mockResolvedValue([hero]);
    mockCreateHero.mockResolvedValue(hero);
    mockUpdateHero.mockResolvedValue(hero);
  });

  // ─── GET ───────────────────────────────────────
  describe("GET", () => {
    it("returns all heroes", async () => {
      const req = createMockRequest({ url: "/api/admin/heroes" });
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
      const req = createMockRequest({ url: "/api/admin/heroes" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on query error", async () => {
      mockGetAdminHeroes.mockRejectedValue(new Error("DB fail"));
      const req = createMockRequest({ url: "/api/admin/heroes" });
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST ──────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      title_ar: "عرض جديد",
      title_he: "מבצע חדש",
      image_url: "/img/hero.jpg",
      link_url: "/store",
    };

    it("creates a hero banner with valid data", async () => {
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateHero).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it("returns 400 for missing title_ar", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { title_he: "test" },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on creation error", async () => {
      mockCreateHero.mockRejectedValue(new Error("insert failed"));
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── PUT ───────────────────────────────────────
  describe("PUT", () => {
    it("updates a hero banner", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "h1", title_ar: "بنر محدث" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      expect(mockUpdateHero).toHaveBeenCalledWith("h1", expect.any(Object));
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
    it("deletes a hero by id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/heroes",
        searchParams: { id: "h1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(mockDeleteHero).toHaveBeenCalledWith("h1");
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/heroes",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on delete error", async () => {
      mockDeleteHero.mockRejectedValue(new Error("delete failed"));
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/heroes",
        searchParams: { id: "h1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(500);
    });
  });
});
