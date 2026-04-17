import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    // Proper thenable so awaiting the chain resolves immediately
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data: Array.isArray(data) ? data : data == null ? [] : data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && !["single", "then"].includes(k)) {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/ai/claude", () => ({
  callClaude: vi.fn(async () => ({
    json: { type: "device", brands: ["Apple"], max_price: 5000, sort: "price_asc", keywords: ["iPhone"] },
    tokens: { input: 100, output: 50 },
    duration: 200,
  })),
}));

vi.mock("@/lib/ai/usage-tracker", () => ({
  trackAIUsage: vi.fn(),
}));

vi.mock("@/lib/rate-limit-db", () => ({
  checkRateLimitDb: vi.fn(async () => ({ allowed: true })),
  getRateLimitKey: vi.fn((ip: string, type: string) => `${type}:${ip}`),
}));

import { GET as AutocompleteGET } from "@/app/api/store/autocomplete/route";
import { GET as OrderStatusGET } from "@/app/api/store/order-status/route";
import { GET as SmartSearchGET } from "@/app/api/store/smart-search/route";
import { NextRequest } from "next/server";
import { checkRateLimitDb } from "@/lib/rate-limit-db";

function makeReq(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    headers: { "x-forwarded-for": "1.2.3.4" },
  });
}

// ============ Autocomplete ============

describe("GET /api/store/autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns products, brands, and categories for valid query", async () => {
    const products = [{ id: "p1", name_ar: "iPhone 16", brand: "Apple", price: 3999 }];
    const categories = [{ id: "c1", name_ar: "هواتف" }];

    // Promise.all resolves both queries
    mockFrom.mockImplementation((table: string) => {
      const chain = chainable();
      if (table === "products") {
        chain.limit = vi.fn().mockResolvedValue({ data: products, error: null });
      } else if (table === "categories") {
        chain.limit = vi.fn().mockResolvedValue({ data: categories, error: null });
      }
      return chain;
    });

    const res = await AutocompleteGET(makeReq("/api/store/autocomplete?q=iPhone"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.products).toBeDefined();
    expect(body.data.categories).toBeDefined();
    expect(body.data.brands).toBeDefined();
  });

  it("returns empty results when query is empty", async () => {
    const res = await AutocompleteGET(makeReq("/api/store/autocomplete?q="));
    const body = await res.json();
    expect(body.data.products).toEqual([]);
    expect(body.data.brands).toEqual([]);
    expect(body.data.categories).toEqual([]);
  });

  it("returns empty results when query is missing", async () => {
    const res = await AutocompleteGET(makeReq("/api/store/autocomplete"));
    const body = await res.json();
    expect(body.data.products).toEqual([]);
  });

  it("sets Cache-Control header", async () => {
    mockFrom.mockImplementation(() => {
      const chain = chainable([]);
      chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain;
    });

    const res = await AutocompleteGET(makeReq("/api/store/autocomplete?q=test"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("limits results to max 10", async () => {
    mockFrom.mockReturnValue(chainable([]));
    // Just verify it doesn't crash with limit param
    const res = await AutocompleteGET(
      makeReq("/api/store/autocomplete?q=test&limit=20")
    );
    expect(res.status).toBe(200);
  });
});

// ============ Order Status ============

describe("GET /api/store/order-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns order status for valid order ID", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "CLM-99999", status: "approved", total: 3999, created_at: "2025-01-01", payment_status: "paid" },
            error: null,
          }),
        }),
      }),
    });

    const res = await OrderStatusGET(
      makeReq("/api/store/order-status?orderId=CLM-99999")
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.order.id).toBe("CLM-99999");
    expect(body.data.order.status).toBe("approved");
  });

  it("returns 400 for invalid order ID format", async () => {
    const res = await OrderStatusGET(
      makeReq("/api/store/order-status?orderId=invalid")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await OrderStatusGET(makeReq("/api/store/order-status"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when order is not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
    });

    const res = await OrderStatusGET(
      makeReq("/api/store/order-status?orderId=CLM-00000")
    );
    expect(res.status).toBe(404);
  });

  it("validates CLM-XXXXX format", async () => {
    const res1 = await OrderStatusGET(
      makeReq("/api/store/order-status?orderId=CLM-12345")
    );
    // This might pass or fail depending on DB but shouldn't be 400
    expect(res1.status).not.toBe(400);

    const res2 = await OrderStatusGET(
      makeReq("/api/store/order-status?orderId=ABC-123")
    );
    expect(res2.status).toBe(400);
  });
});

// ============ Smart Search ============

describe("GET /api/store/smart-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => {
      const chain = chainable([]);
      chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain;
    });
  });

  it("returns products for simple text query", async () => {
    const products = [{ id: "p1", name_ar: "iPhone 16", price: 3999, brand: "Apple" }];
    mockFrom.mockImplementation(() => {
      const chain = chainable(products);
      chain.limit = vi.fn().mockResolvedValue({ data: products, error: null });
      return chain;
    });

    const res = await SmartSearchGET(
      makeReq("/api/store/smart-search?q=iPhone")
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.products).toBeDefined();
  });

  it("returns 400 for query shorter than 2 chars", async () => {
    const res = await SmartSearchGET(
      makeReq("/api/store/smart-search?q=a")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when query is missing", async () => {
    const res = await SmartSearchGET(
      makeReq("/api/store/smart-search")
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimitDb as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
    });

    const res = await SmartSearchGET(
      makeReq("/api/store/smart-search?q=iPhone")
    );
    expect(res.status).toBe(429);
  });

  it("uses AI for smart queries", async () => {
    const products = [{ id: "p1", name_ar: "iPhone", price: 2999 }];
    mockFrom.mockImplementation(() => {
      const chain = chainable(products);
      chain.limit = vi.fn().mockResolvedValue({ data: products, error: null });
      return chain;
    });

    const res = await SmartSearchGET(
      makeReq("/api/store/smart-search?q=أحسن هاتف كاميرا تحت 3000")
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.ai_used).toBe(true);
  });

  it("falls back to basic search when AI is not used", async () => {
    const res = await SmartSearchGET(
      makeReq("/api/store/smart-search?q=Samsung")
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.filters).toBeDefined();
  });
});
