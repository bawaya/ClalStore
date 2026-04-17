import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Supabase mock ---
const { mockFrom, mockRequireAdmin } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data : data ? [data] : [], error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && !["single", "maybeSingle", "then"].includes(k)) {
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

import { GET, POST, PUT, DELETE } from "@/app/api/reviews/route";
import { NextRequest } from "next/server";

function makeReq(
  url: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const opts: RequestInit = { method, headers: { ...headers } };
  if (body) {
    opts.body = JSON.stringify(body);
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new NextRequest(`http://localhost${url}`, opts as any);
}

describe("GET /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public reviews for a product", async () => {
    const reviews = [
      { id: "r1", rating: 5, product_id: "p1" },
      { id: "r2", rating: 4, product_id: "p1" },
    ];
    const chain = chainable(reviews);
    // Override the chain to resolve with data for the query
    chain.order = vi.fn().mockReturnValue({
      ...chain,
      then: (resolve: (v: unknown) => void) => resolve({ data: reviews, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeReq("/api/reviews?product_id=p1"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns empty reviews when no product_id", async () => {
    const res = await GET(makeReq("/api/reviews"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reviews).toEqual([]);
  });

  it("returns all reviews for admin", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    const chain = chainable([]);
    chain.order = vi.fn().mockReturnValue({
      ...chain,
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeReq("/api/reviews?admin=true"));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("blocks unauthenticated admin requests", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(makeReq("/api/reviews?admin=true"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a review when feature is enabled", async () => {
    const settingsChain = chainable({ value: "true" });
    const reviewsChain = chainable(null); // no existing review
    const insertChain = chainable({ id: "r-new", status: "pending" });
    const customersChain = chainable({ id: "c1" });
    const orderItemsChain = chainable([{ id: "oi1" }]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "product_reviews") {
        const chain = chainable(null);
        // For the existing check, return null (no existing review)
        // For the insert, return the new review
        chain.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "r-new", status: "pending" },
              error: null,
            }),
          }),
        });
        return chain;
      }
      if (table === "customers") return customersChain;
      if (table === "order_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) =>
                resolve({ data: [{ id: "oi1" }], error: null }),
            }),
          }),
        };
      }
      return chainable();
    });

    const res = await POST(
      makeReq("/api/reviews", "POST", {
        product_id: "p1",
        customer_name: "Ahmad",
        rating: 5,
        title: "Great phone",
        body: "Love it",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns 403 when reviews feature is disabled", async () => {
    mockFrom.mockReturnValue(chainable({ value: "false" }));

    const res = await POST(
      makeReq("/api/reviews", "POST", {
        product_id: "p1",
        customer_name: "Ahmad",
        rating: 5,
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    mockFrom.mockReturnValue(chainable({ value: "true" }));

    const res = await POST(
      makeReq("/api/reviews", "POST", {
        product_id: "p1",
        // missing customer_name and rating
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when customer already reviewed this product", async () => {
    const settingsChain = chainable({ value: "true" });
    const existingReview = chainable({ id: "r-existing" });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "product_reviews") return existingReview;
      return chainable();
    });

    const res = await POST(
      makeReq("/api/reviews", "POST", {
        product_id: "p1",
        customer_name: "Ahmad",
        customer_phone: "0533337653",
        rating: 5,
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates review status as admin", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    const chain = chainable({ id: "r1", status: "approved" });
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "r1", status: "approved" },
            error: null,
          }),
        }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await PUT(
      makeReq("/api/reviews", "PUT", { id: "r1", status: "approved" })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );
    const res = await PUT(
      makeReq("/api/reviews", "PUT", { id: "r1", status: "approved" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    mockFrom.mockReturnValue(chainable());

    const res = await PUT(
      makeReq("/api/reviews", "PUT", { status: "approved" })
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes review as admin", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    const chain = chainable(null, null);
    chain.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(makeReq("/api/reviews?id=r1", "DELETE"));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );
    const res = await DELETE(makeReq("/api/reviews?id=r1", "DELETE"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    mockFrom.mockReturnValue(chainable());

    const res = await DELETE(makeReq("/api/reviews", "DELETE"));
    expect(res.status).toBe(400);
  });
});
