/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";
import type { MockSupabaseClient } from "@/tests/helpers/supabase-mock";

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

import { GET, PUT } from "@/app/api/admin/website/route";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";

// ── Tests ──────────────────────────────────────────────
describe("Admin Website API — /api/admin/website", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabaseClient({
      website_content: { data: [{ id: "w1", section: "hero", title_ar: "عنوان", title_he: "כותרת", is_visible: true, sort_order: 0 }] },
    });
    (createAdminSupabase as any).mockImplementation(() => mockClient);
    (createServerSupabase as any).mockImplementation(() => mockClient);
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    });
  });

  describe("GET", () => {
    it("returns website content sections", async () => {
      const req = createMockRequest({ url: "/api/admin/website" });
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
      const req = createMockRequest({ url: "/api/admin/website" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on DB error", async () => {
      const builder = mockClient.__queryBuilders.get("website_content")!;
      builder.__setError({ message: "DB fail" });
      builder.__setData(null);

      const req = createMockRequest({ url: "/api/admin/website" });
      const res = await GET(req);

      expect(res.status).toBe(500);

      builder.__setError(null);
      builder.__setData([{ id: "w1" }]);
    });
  });

  describe("PUT", () => {
    it("updates a website section", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "w1", title_ar: "عنوان محدث" },
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { title_ar: "no id" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({
        method: "PUT",
        body: { id: "w1", title_ar: "test" },
      });
      const res = await PUT(req);

      expect(res.status).toBe(401);
    });
  });
});
