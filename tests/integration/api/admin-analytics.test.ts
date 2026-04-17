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

import { GET } from "@/app/api/admin/analytics/route";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";

// ── Tests ──────────────────────────────────────────────
describe("Admin Analytics API — /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-install client for each test (works around helper's hoisted vi.mock bug)
    const client = createMockSupabaseClient({
      orders: { data: [{ id: "CLM-1", total: 3499, status: "approved", source: "store", created_at: new Date().toISOString() }] },
      bot_analytics: { data: [{ date: "2026-04-10", conversations: 15, messages: 80, handoffs: 3, csat_avg: 4.5, store_clicks: 10 }] },
      inbox_conversations: { data: [{ id: "ic1", status: "active", sentiment: "positive", created_at: new Date().toISOString() }] },
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

  describe("GET", () => {
    it("returns analytics data with sales, bot, and inbox sections", async () => {
      const req = createMockRequest({
        url: "/api/admin/analytics",
        searchParams: { days: "30" },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.sales).toBeDefined();
      expect(body.bot).toBeDefined();
      expect(body.inbox).toBeDefined();
    });

    it("sales section includes expected fields", async () => {
      const req = createMockRequest({ url: "/api/admin/analytics" });
      const res = await GET(req);
      const body = await res.json();

      expect(body.sales).toHaveProperty("totalRevenue");
      expect(body.sales).toHaveProperty("totalOrders");
      expect(body.sales).toHaveProperty("avgOrderValue");
      expect(body.sales).toHaveProperty("statusBreakdown");
      expect(body.sales).toHaveProperty("sourceBreakdown");
      expect(body.sales).toHaveProperty("revenueChange");
    });

    it("bot section includes expected fields", async () => {
      const req = createMockRequest({ url: "/api/admin/analytics" });
      const res = await GET(req);
      const body = await res.json();

      expect(body.bot).toHaveProperty("totalConversations");
      expect(body.bot).toHaveProperty("totalHandoffs");
      expect(body.bot).toHaveProperty("avgCsat");
    });

    it("accepts custom days parameter", async () => {
      const req = createMockRequest({
        url: "/api/admin/analytics",
        searchParams: { days: "7" },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/analytics" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 when DB client is null", async () => {
      (createAdminSupabase as any).mockReturnValueOnce(null);

      const req = createMockRequest({ url: "/api/admin/analytics" });
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });
});
