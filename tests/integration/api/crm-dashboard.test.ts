/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";

// ── Mocks ─────────────────────────────────────────────
const mockDashboardData = {
  orders: { total: 50, revenue: 150000, avgOrder: 3000 },
  customers: { total: 200, new: 10 },
  pipeline: { deals: 15, value: 52000 },
  tasks: { pending: 5, overdue: 2 },
};

const mockGetCRMDashboard = vi.fn().mockResolvedValue(mockDashboardData);

vi.mock("@/lib/crm/queries", () => ({
  getCRMDashboard: (...args: any[]) => mockGetCRMDashboard(...args),
}));

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
    }),
  };
});

// ── Imports ───────────────────────────────────────────
import { GET } from "@/app/api/crm/dashboard/route";

// ── Tests ─────────────────────────────────────────────

describe("CRM Dashboard — GET /api/crm/dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns dashboard data", async () => {
    const req = createMockRequest({ url: "/api/crm/dashboard" });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetCRMDashboard).toHaveBeenCalled();
  });

  it("passes date range filters", async () => {
    const req = createMockRequest({
      url: "/api/crm/dashboard",
      searchParams: { dateFrom: "2026-04-01", dateTo: "2026-04-17" },
    });
    await GET(req);
    expect(mockGetCRMDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: "2026-04-01", dateTo: "2026-04-17" }),
    );
  });

  it("works without date filters", async () => {
    const req = createMockRequest({ url: "/api/crm/dashboard" });
    await GET(req);
    expect(mockGetCRMDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: undefined, dateTo: undefined }),
    );
  });

  it("returns 500 when dashboard query fails", async () => {
    mockGetCRMDashboard.mockRejectedValueOnce(new Error("DB error"));
    const req = createMockRequest({ url: "/api/crm/dashboard" });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
