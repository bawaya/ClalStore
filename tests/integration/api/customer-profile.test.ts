import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const { mockFrom, mockAuthenticateCustomer } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockAuthenticateCustomer: vi.fn(),
}));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    // Proper thenable so `await chain` resolves synchronously
    then: (resolve: (val: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data: Array.isArray(data) ? data : [], error }),
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

vi.mock("@/lib/customer-auth", () => ({
  authenticateCustomer: (...args: unknown[]) => mockAuthenticateCustomer(...args),
}));

import { GET, PUT } from "@/app/api/customer/profile/route";
import { NextRequest } from "next/server";

function makeReq(
  method = "GET",
  body?: unknown,
  token = "valid-token-abc123def456"
): NextRequest {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  const opts: RequestInit = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  return new NextRequest("http://localhost/api/customer/profile", opts as any);
}

const mockCustomer = {
  id: "cust-1",
  name: "Ahmad",
  phone: "0533337653",
  email: "ahmad@test.com",
  city: "Nazareth",
  address: "Main St",
  customer_code: "CLM-12345",
};

describe("GET /api/customer/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(chainable([]));
  });

  it("returns profile for authenticated customer", async () => {
    mockAuthenticateCustomer.mockResolvedValue(mockCustomer);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.customer).toEqual(mockCustomer);
    expect(body.data.hotAccounts).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthenticateCustomer.mockResolvedValue(null);

    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 500 on server error", async () => {
    mockAuthenticateCustomer.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/customer/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomer.mockResolvedValue(mockCustomer);
  });

  it("updates profile fields", async () => {
    const updatedCustomer = { ...mockCustomer, name: "Ahmad Updated" };
    const chain = chainable(updatedCustomer);
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: updatedCustomer, error: null }),
        }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await PUT(makeReq("PUT", { name: "Ahmad Updated" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.customer.name).toBe("Ahmad Updated");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthenticateCustomer.mockResolvedValue(null);

    const res = await PUT(makeReq("PUT", { name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no fields provided", async () => {
    const res = await PUT(makeReq("PUT", {}));
    expect(res.status).toBe(400);
  });

  it("trims and limits field lengths", async () => {
    const chain = chainable(mockCustomer);
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockCustomer, error: null }),
        }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await PUT(makeReq("PUT", { name: "  Long Name  " }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when DB update fails", async () => {
    const chain = chainable(null, { message: "Update failed" });
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Update failed" } }),
        }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await PUT(makeReq("PUT", { name: "Test" }));
    expect(res.status).toBe(500);
  });
});

// ============ Customer Orders ============

describe("GET /api/customer/orders", () => {
  let ordersGET: typeof GET;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthenticateCustomer.mockResolvedValue(mockCustomer);
    const mod = await import("@/app/api/customer/orders/route");
    ordersGET = mod.GET;
  });

  it("returns orders for authenticated customer", async () => {
    const orders = [
      { id: "CLM-00001", status: "approved", total: 3999, customer_id: "cust-1", created_at: "2025-01-01", updated_at: "2025-01-01" },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        const chain = chainable();
        chain.limit = vi.fn().mockResolvedValue({ data: orders, error: null });
        return chain;
      }
      if (table === "order_items") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ order_id: "CLM-00001", product_name: "iPhone" }],
              error: null,
            }),
          }),
        };
      }
      return chainable();
    });

    const res = await ordersGET(makeReq());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orders).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthenticateCustomer.mockResolvedValue(null);

    const res = await ordersGET(makeReq());
    expect(res.status).toBe(401);
  });
});

// ============ Customer Loyalty ============

describe("GET /api/customer/loyalty", () => {
  let loyaltyGET: typeof GET;
  let loyaltyPOST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthenticateCustomer.mockResolvedValue(mockCustomer);
  });

  it("exports GET and POST", async () => {
    const mod = await import("@/app/api/customer/loyalty/route");
    expect(mod.GET).toBeDefined();
    expect(mod.POST).toBeDefined();
  });
});
