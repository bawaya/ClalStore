import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && k !== "single") {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { POST } from "@/app/api/coupons/validate/route";
import { NextRequest } from "next/server";

let ipCounter = 0;
function makeReq(
  body: unknown,
  ip?: string
): NextRequest {
  // Each call gets a unique IP by default so rate limiter doesn't kick in across tests
  const useIp = ip ?? `192.0.2.${++ipCounter % 250}`;
  return new NextRequest("http://localhost/api/coupons/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": useIp,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coupons/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid=true for a valid percent coupon", async () => {
    mockFrom.mockReturnValue(
      chainable({
        code: "SAVE10",
        type: "percent",
        value: 10,
        active: true,
        expires_at: null,
        max_uses: 0,
        used_count: 0,
        min_order: 0,
      })
    );

    const res = await POST(makeReq({ code: "SAVE10", total: 1000 }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.discount).toBe(100); // 10% of 1000
    expect(body.data.message).toContain("10%");
  });

  it("returns valid=true for a valid fixed coupon", async () => {
    mockFrom.mockReturnValue(
      chainable({
        code: "FLAT50",
        type: "fixed",
        value: 50,
        active: true,
        expires_at: null,
        max_uses: 0,
        used_count: 0,
        min_order: 0,
      })
    );

    const res = await POST(makeReq({ code: "FLAT50", total: 200 }));
    const body = await res.json();
    expect(body.data.valid).toBe(true);
    expect(body.data.discount).toBe(50);
  });

  it("caps fixed discount at total amount", async () => {
    mockFrom.mockReturnValue(
      chainable({
        code: "BIG200",
        type: "fixed",
        value: 200,
        active: true,
        expires_at: null,
        max_uses: 0,
        used_count: 0,
        min_order: 0,
      })
    );

    const res = await POST(makeReq({ code: "BIG200", total: 100 }));
    const body = await res.json();
    expect(body.data.discount).toBe(100); // capped at total
  });

  it("returns valid=false for expired coupon", async () => {
    mockFrom.mockReturnValue(
      chainable({
        code: "EXPIRED",
        type: "percent",
        value: 10,
        active: true,
        expires_at: "2020-01-01T00:00:00Z",
        max_uses: 0,
        used_count: 0,
        min_order: 0,
      })
    );

    const res = await POST(makeReq({ code: "EXPIRED", total: 100 }));
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  it("returns valid=false for exhausted coupon", async () => {
    mockFrom.mockReturnValue(
      chainable({
        code: "USED",
        type: "fixed",
        value: 10,
        active: true,
        expires_at: null,
        max_uses: 5,
        used_count: 5,
        min_order: 0,
      })
    );

    const res = await POST(makeReq({ code: "USED", total: 100 }));
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  it("returns valid=false when order is below minimum", async () => {
    mockFrom.mockReturnValue(
      chainable({
        code: "MIN500",
        type: "fixed",
        value: 50,
        active: true,
        expires_at: null,
        max_uses: 0,
        used_count: 0,
        min_order: 500,
      })
    );

    const res = await POST(makeReq({ code: "MIN500", total: 200 }));
    const body = await res.json();
    expect(body.data.valid).toBe(false);
    expect(body.data.message).toContain("500");
  });

  it("returns valid=false for non-existent coupon", async () => {
    mockFrom.mockReturnValue(chainable(null));

    const res = await POST(makeReq({ code: "NONEXIST", total: 100 }));
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  it("returns error when code is missing", async () => {
    const res = await POST(makeReq({ total: 100 }));
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  it("returns error when total is missing", async () => {
    const res = await POST(makeReq({ code: "ABC" }));
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  it("rate limits after too many attempts from same IP", async () => {
    mockFrom.mockReturnValue(chainable(null));

    // Send 5 requests (within the limit)
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ code: "TEST", total: 100 }, "10.10.10.10"));
    }

    // 6th request should be rate limited
    const res = await POST(
      makeReq({ code: "TEST", total: 100 }, "10.10.10.10")
    );
    expect(res.status).toBe(429);
  });

  it("uppercases the coupon code for lookup", async () => {
    mockFrom.mockReturnValue(chainable(null));
    await POST(makeReq({ code: "save10", total: 100 }));
    // The eq mock should have been called with the uppercased code
    expect(mockFrom).toHaveBeenCalledWith("coupons");
  });
});
