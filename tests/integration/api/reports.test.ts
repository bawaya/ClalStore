import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Mocks ---
const { mockFrom, mockRequireAdmin } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

function chainable(data: unknown = [], error: unknown = null) {
  const result = { data: Array.isArray(data) ? data : [], error };
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // `then` must CALL the resolver so `await obj` works
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && k !== "then" && k !== "single" && k !== "maybeSingle") {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

import { GET as DailyGET } from "@/app/api/reports/daily/route";
import { GET as WeeklyGET } from "@/app/api/reports/weekly/route";
import { NextRequest } from "next/server";

function makeReq(
  url: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers });
}

// ============ Daily Report ============

describe("GET /api/reports/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";

    // Return empty arrays for all tables
    mockFrom.mockReturnValue(chainable([]));
  });

  it("returns HTML report when authenticated as admin", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });

    const res = await DailyGET(
      makeReq("/api/reports/daily?date=2025-01-15")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("2025-01-15");
    expect(html).toContain("التقرير اليومي");
  });

  it("returns HTML report when authenticated via CRON_SECRET", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );

    const res = await DailyGET(
      makeReq("/api/reports/daily?date=2025-01-15&secret=cron-secret-123")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );

    const res = await DailyGET(makeReq("/api/reports/daily"));
    expect(res.status).toBe(401);
  });

  it("uses current date when date param is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });

    const res = await DailyGET(makeReq("/api/reports/daily"));
    expect(res.status).toBe(200);
    const html = await res.text();
    // Should contain today's date
    const today = new Date().toISOString().split("T")[0];
    expect(html).toContain(today);
  });

  it("renders order statistics in the HTML", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });

    const orders = [
      {
        id: "CLM-00001",
        status: "approved",
        total: 3999,
        source: "store",
        customer_id: "c1",
        created_at: "2025-01-15T10:00:00Z",
        order_items: [{ product_name: "iPhone 16", product_type: "device", quantity: 1, price: 3999 }],
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return chainable(orders);
      }
      return chainable([]);
    });

    const res = await DailyGET(
      makeReq("/api/reports/daily?date=2025-01-15")
    );
    const html = await res.text();
    expect(html).toContain("CLM-00001");
    expect(html).toContain("3,999");
  });

  it("returns 500 when DB is unavailable", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    const { createAdminSupabase } = await import("@/lib/supabase");
    (createAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const res = await DailyGET(
      makeReq("/api/reports/daily?date=2025-01-15")
    );
    expect(res.status).toBe(500);
  });
});

// ============ Weekly Report ============

describe("GET /api/reports/weekly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
    mockFrom.mockReturnValue(chainable([]));
  });

  it("returns HTML report when authenticated as admin", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });

    const res = await WeeklyGET(
      makeReq("/api/reports/weekly?date=2025-01-15")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("التقرير الأسبوعي");
  });

  it("returns HTML report with CRON_SECRET auth", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 401 })
    );

    const res = await WeeklyGET(
      makeReq("/api/reports/weekly?secret=cron-secret-123")
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );

    const res = await WeeklyGET(makeReq("/api/reports/weekly"));
    expect(res.status).toBe(401);
  });

  it("includes comparison with previous week", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });

    const res = await WeeklyGET(
      makeReq("/api/reports/weekly?date=2025-01-15")
    );
    const html = await res.text();
    expect(html).toContain("الأسبوع السابق");
  });

  it("includes top products section", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });

    const orders = [
      {
        id: "CLM-00001",
        total: 3999,
        status: "approved",
        source: "store",
        created_at: "2025-01-15T10:00:00Z",
        order_items: [
          { product_name: "iPhone 16", product_type: "device", quantity: 1, price: 3999 },
        ],
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return chainable(orders);
      return chainable([]);
    });

    const res = await WeeklyGET(
      makeReq("/api/reports/weekly?date=2025-01-15")
    );
    const html = await res.text();
    expect(html).toContain("أفضل المنتجات");
  });

  it("returns 500 when DB is unavailable", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    const { createAdminSupabase } = await import("@/lib/supabase");
    (createAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const res = await WeeklyGET(
      makeReq("/api/reports/weekly?date=2025-01-15")
    );
    expect(res.status).toBe(500);
  });
});
