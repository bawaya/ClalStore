import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { createSupabaseChain } from "./_helpers/supabase-mock";

const { mockFrom, mockAuthenticateCustomer } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockAuthenticateCustomer: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/customer-auth", () => ({
  authenticateCustomer: mockAuthenticateCustomer,
}));

import { GET } from "@/app/api/store/order-status/route";
import { NextRequest } from "next/server";

function makeReq(params: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/store/order-status");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new NextRequest(url, { method: "GET", headers });
}

const order = {
  id: "CLM-99999",
  customer_id: "cust-1",
  status: "processing",
  total: 3999,
  created_at: "2026-04-30T10:00:00.000Z",
  payment_status: "paid",
  customers: {
    id: "cust-1",
    phone: "0533337653",
    email: "ahmad@example.com",
    customer_code: "CLAL-001",
  },
};

describe("GET /api/store/order-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomer.mockResolvedValue(null);
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return createSupabaseChain(order);
      return createSupabaseChain();
    });
  });

  it("rejects order number alone", async () => {
    const res = await GET(makeReq({ orderId: "CLM-99999" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("تعذر التحقق من الطلب");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a wrong verification factor", async () => {
    const res = await GET(makeReq({ orderId: "CLM-99999", phoneSuffix: "0000" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("تعذر التحقق من الطلب");
  });

  it("returns order status with a valid phone suffix", async () => {
    const res = await GET(makeReq({ orderId: "CLM-99999", phoneSuffix: "7653" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.order).toEqual({
      id: "CLM-99999",
      status: "processing",
      total: 3999,
      created_at: "2026-04-30T10:00:00.000Z",
      payment_status: "paid",
    });
  });

  it("returns order status with a valid email verification factor", async () => {
    const res = await GET(makeReq({ orderId: "CLM-99999", email: "AHMAD@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.order.id).toBe("CLM-99999");
  });

  it("returns a generic response for a non-existing order", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return createSupabaseChain(null, { message: "not found" });
      return createSupabaseChain();
    });

    const res = await GET(makeReq({ orderId: "CLM-00000", phoneSuffix: "7653" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("تعذر التحقق من الطلب");
  });

  it("does not leak whether enumeration attempts hit an existing order", async () => {
    const wrongFactorRes = await GET(makeReq({ orderId: "CLM-99999", phoneSuffix: "0000" }));
    const wrongFactorBody = await wrongFactorRes.json();

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return createSupabaseChain(null, { message: "not found" });
      return createSupabaseChain();
    });

    const missingOrderRes = await GET(makeReq({ orderId: "CLM-00000", phoneSuffix: "0000" }));
    const missingOrderBody = await missingOrderRes.json();

    expect(wrongFactorRes.status).toBe(missingOrderRes.status);
    expect(wrongFactorBody.error).toBe(missingOrderBody.error);
    expect(JSON.stringify(wrongFactorBody)).not.toMatch(/found|exists|موجود/i);
    expect(JSON.stringify(missingOrderBody)).not.toMatch(/found|exists|موجود/i);
  });

  it("allows an authenticated customer to view their own order", async () => {
    mockAuthenticateCustomer.mockResolvedValue({ id: "cust-1" });

    const res = await GET(
      makeReq({ orderId: "CLM-99999" }, { Authorization: "Bearer customer-token" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.order.id).toBe("CLM-99999");
  });
});

describe("/store/track compatibility", () => {
  it("sends the generic verification factor supported by the order-status API", () => {
    const source = readFileSync("app/store/track/page.tsx", "utf8");

    expect(source).toContain("verificationFactor");
    expect(source).toContain("new URLSearchParams({ orderId: id, verification })");
    expect(source).toContain("/api/store/order-status?");
  });
});
