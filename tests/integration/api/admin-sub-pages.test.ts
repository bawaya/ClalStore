/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeSubPage } from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const subPage = makeSubPage({ id: "sp1", slug: "about", title_ar: "عن الموقع" });

// ── Supabase mock ─────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  sub_pages: { data: [subPage] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

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

// ── Imports ───────────────────────────────────────────
import { GET, POST, PUT, DELETE } from "@/app/api/admin/sub-pages/route";

// ── Tests ─────────────────────────────────────────────

describe("Admin Sub-Pages — /api/admin/sub-pages", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns all sub-pages", async () => {
      const req = createMockRequest({ url: "/api/admin/sub-pages" });
      const res = await GET(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  describe("POST", () => {
    it("creates a sub-page", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/admin/sub-pages",
        body: {
          slug: "terms",
          title_ar: "الشروط",
          content_ar: "محتوى الشروط",
        },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 for invalid slug", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/admin/sub-pages",
        body: {
          slug: "INVALID SLUG!",
          title_ar: "Test",
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing title_ar", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/admin/sub-pages",
        body: { slug: "test" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT", () => {
    it("updates a sub-page", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/admin/sub-pages",
        body: { id: "sp1", title_ar: "عن الموقع - محدث" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 without id", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/admin/sub-pages",
        body: { title_ar: "No ID" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("deletes a sub-page", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/sub-pages",
        searchParams: { id: "sp1" },
      });
      const res = await DELETE(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 without id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/sub-pages",
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
