import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
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
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    // Proper thenable so `await chain` resolves immediately
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data: Array.isArray(data) ? data : data == null ? [] : data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && k !== "single" && k !== "maybeSingle" && k !== "then") {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
  createServerSupabase: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getRateLimitKey: vi.fn((phone: string, type: string) => `${type}:${phone}`),
}));

vi.mock("@/lib/validators", () => ({
  generateCustomerCode: vi.fn(() => "CLM-12345"),
  generateOrderId: vi.fn(() => "CLM-99999"),
  validatePhone: vi.fn((phone: string) => /^0\d{8,9}$/.test(phone.replace(/[-\s]/g, ""))),
  validateIsraeliID: vi.fn(() => true),
}));

vi.mock("@/lib/bot/notifications", () => ({
  notifyNewOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/bot/admin-notify", () => ({
  notifyAdminNewOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email-templates", () => ({
  orderConfirmationEmail: vi.fn(() => ({ subject: "Order", html: "<p>Order</p>" })),
}));

vi.mock("@/lib/integrations/hub", () => ({
  getProvider: vi.fn(() => null),
}));

import { POST } from "@/app/api/orders/route";
import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validOrder = {
  customer: {
    name: "Ahmad Test",
    phone: "0533337653",
    city: "Nazareth",
    address: "Main St 1",
  },
  items: [
    {
      productId: "prod-1",
      name: "iPhone 16",
      brand: "Apple",
      type: "device",
      price: 3999,
    },
  ],
};

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const custChain = chainable({ id: "cust-1", customer_code: "CLM-12345" });
    const prodChain = chainable([{ id: "prod-1", price: 3999 }]);
    const couponChain = chainable(null);

    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return custChain;
      if (table === "products") return prodChain;
      if (table === "coupons") return couponChain;
      return chainable();
    });

    mockRpc.mockResolvedValue({ data: { order_id: "CLM-99999" }, error: null });
  });

  it("creates order successfully for existing customer", async () => {
    const res = await POST(makeReq(validOrder));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBe("CLM-99999");
    expect(body.data.total).toBeDefined();
  });

  it("returns 400 with missing customer data", async () => {
    const res = await POST(makeReq({ items: validOrder.items }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with empty items array", async () => {
    const res = await POST(
      makeReq({ customer: validOrder.customer, items: [] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is invalid", async () => {
    const order = {
      ...validOrder,
      customer: { ...validOrder.customer, phone: "123" },
    };
    const res = await POST(makeReq(order));
    expect(res.status).toBe(400);
  });

  it("returns 400 when items lack productId", async () => {
    const order = {
      ...validOrder,
      items: [{ name: "iPhone", brand: "Apple", type: "device", price: 3999 }],
    };
    const res = await POST(makeReq(order));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce({ allowed: false });
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(429);
  });

  it("returns 500 when rpc fails with generic error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Database timeout" },
    });
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(500);
  });

  it("returns 409 when rpc reports stock error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "المخزون غير كافٍ للمنتج prod-1" },
    });
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(409);
  });

  it("sets needsPayment=false for device orders", async () => {
    const res = await POST(makeReq(validOrder));
    const body = await res.json();
    expect(body.data.needsPayment).toBe(false);
  });

  it("sets needsPayment=true for accessory-only orders", async () => {
    const order = {
      ...validOrder,
      items: [
        { productId: "acc-1", name: "Case", brand: "Generic", type: "accessory", price: 50 },
      ],
    };
    const res = await POST(makeReq(order));
    const body = await res.json();
    expect(body.data.needsPayment).toBe(true);
  });
});
