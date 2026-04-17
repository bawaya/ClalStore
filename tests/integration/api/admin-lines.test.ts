/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeLinePlan } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
const line = makeLinePlan({ id: "l1", name_ar: "باقة أساسية" });

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

const mockGetAdminLines = vi.fn().mockResolvedValue([line]);
const mockCreateLine = vi.fn().mockResolvedValue(line);
const mockUpdateLine = vi.fn().mockResolvedValue(line);
const mockDeleteLine = vi.fn().mockResolvedValue(undefined);
const mockLogAction = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/admin/queries", () => ({
  getAdminLines: (...args: any[]) => mockGetAdminLines(...args),
  createLine: (...args: any[]) => mockCreateLine(...args),
  updateLine: (...args: any[]) => mockUpdateLine(...args),
  deleteLine: (...args: any[]) => mockDeleteLine(...args),
  logAction: (...args: any[]) => mockLogAction(...args),
}));

vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/admin/lines/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin Lines API — /api/admin/lines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    mockGetAdminLines.mockResolvedValue([line]);
    mockCreateLine.mockResolvedValue(line);
    mockUpdateLine.mockResolvedValue(line);
  });

  // ─── GET ───────────────────────────────────────
  describe("GET", () => {
    it("returns all line plans", async () => {
      const req = createMockRequest({ url: "/api/admin/lines" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("sets Cache-Control header", async () => {
      const req = createMockRequest({ url: "/api/admin/lines" });
      const res = await GET(req);

      expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/lines" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 on query error", async () => {
      mockGetAdminLines.mockRejectedValue(new Error("DB fail"));
      const req = createMockRequest({ url: "/api/admin/lines" });
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST ──────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      name_ar: "باقة بريميوم",
      name_he: "תוכנית פרימיום",
      data_amount: "50GB",
      price: 99,
    };

    it("creates a line plan with valid data", async () => {
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateLine).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalled();
    });

    it("returns 400 for missing required fields", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { name_ar: "test" }, // missing data_amount, price
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on creation error", async () => {
      mockCreateLine.mockRejectedValue(new Error("insert failed"));
      const req = createMockRequest({ method: "POST", body: validBody });
      const res = await POST(req);

      expect(res.status).toBe(500);
    });
  });

  // ─── PUT ───────────────────────────────────────
  describe("PUT", () => {
    it("updates a line plan", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { id: "l1", price: 49 },
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      expect(mockUpdateLine).toHaveBeenCalledWith("l1", expect.any(Object));
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        body: { price: 49 },
      });
      const res = await PUT(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ────────────────────────────────────
  describe("DELETE", () => {
    it("deletes a line plan by id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/lines",
        searchParams: { id: "l1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(mockDeleteLine).toHaveBeenCalledWith("l1");
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/lines",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 on delete error", async () => {
      mockDeleteLine.mockRejectedValue(new Error("delete failed"));
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/admin/lines",
        searchParams: { id: "l1" },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(500);
    });
  });
});
