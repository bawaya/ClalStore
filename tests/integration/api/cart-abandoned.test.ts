import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && !["single", "maybeSingle"].includes(k)) {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { POST, DELETE } from "@/app/api/cart/abandoned/route";
import { NextRequest } from "next/server";

function makeReq(
  method: string,
  body?: unknown,
  url = "http://localhost/api/cart/abandoned"
): NextRequest {
  const opts: RequestInit = { method, headers: {} };
  if (body) {
    opts.body = JSON.stringify(body);
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new NextRequest(url, opts as any);
}

describe("POST /api/cart/abandoned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when feature is enabled and cart is new", async () => {
    const settingsChain = chainable({ value: "true" });
    const cartChain = chainable(null); // no existing cart

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "abandoned_carts") return cartChain;
      return chainable();
    });

    const res = await POST(
      makeReq("POST", {
        visitor_id: "v-123",
        items: [{ name: "iPhone", price: 3999 }],
        total: 3999,
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.status).toBe(200);
  });

  it("updates existing cart for same visitor", async () => {
    const settingsChain = chainable({ value: "true" });
    const existingCart = chainable({ id: "cart-1" });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "abandoned_carts") return existingCart;
      return chainable();
    });

    const res = await POST(
      makeReq("POST", {
        visitor_id: "v-123",
        items: [{ name: "Galaxy", price: 2999 }],
        total: 2999,
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns success silently when feature is disabled", async () => {
    mockFrom.mockReturnValue(chainable({ value: "false" }));

    const res = await POST(
      makeReq("POST", {
        visitor_id: "v-123",
        items: [{ name: "iPhone", price: 3999 }],
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns success silently when validation fails (missing visitor_id)", async () => {
    mockFrom.mockReturnValue(chainable({ value: "true" }));

    const res = await POST(
      makeReq("POST", { items: [{ name: "iPhone" }] })
    );
    const body = await res.json();
    expect(body.success).toBe(true); // silent failure by design
  });

  it("returns success silently when items is empty", async () => {
    mockFrom.mockReturnValue(chainable({ value: "true" }));

    const res = await POST(
      makeReq("POST", { visitor_id: "v-123", items: [] })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns success even on DB error (fire-and-forget)", async () => {
    const settingsChain = chainable({ value: "true" });
    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "abandoned_carts") throw new Error("DB down");
      return chainable();
    });

    const res = await POST(
      makeReq("POST", {
        visitor_id: "v-123",
        items: [{ name: "iPhone", price: 3999 }],
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("DELETE /api/cart/abandoned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks cart as recovered", async () => {
    const chain = chainable(null);
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        "http://localhost/api/cart/abandoned?visitor_id=v-123"
      )
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns success even without visitor_id", async () => {
    const res = await DELETE(
      makeReq("DELETE", undefined, "http://localhost/api/cart/abandoned")
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns success even on error (silent)", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("DB error");
    });

    const res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        "http://localhost/api/cart/abandoned?visitor_id=v-123"
      )
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
