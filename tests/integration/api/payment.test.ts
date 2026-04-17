import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && k !== "single" && k !== "maybeSingle") {
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

vi.mock("@/lib/integrations/hub", () => ({
  getIntegrationConfig: vi.fn(async (type: string) => {
    if (type === "payment") return { group_private_token: "gpt-123" };
    if (type === "payment_upay") return { api_username: "upay-user" };
    return {};
  }),
}));

vi.mock("@/lib/payment-gateway", () => ({
  detectPaymentGateway: vi.fn(() => "rivhit"),
}));

vi.mock("@/lib/integrations/rivhit", () => ({
  createPaymentPage: vi.fn(async () => ({
    success: true,
    paymentUrl: "https://icredit.rivhit.co.il/pay/test",
    privateSaleToken: "pst-123",
  })),
  verifyIPN: vi.fn(async () => ({ verified: true })),
}));

vi.mock("@/lib/integrations/upay", () => ({
  createUpayPaymentPage: vi.fn(async () => ({
    success: true,
    paymentUrl: "https://upay.co.il/pay/test",
  })),
}));

vi.mock("@/lib/webhook-verify", () => ({
  verifyWebhookSignature: vi.fn(async () => true),
}));

vi.mock("@/lib/bot/notifications", () => ({
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/payment/route";
import { POST as CallbackPOST, GET as CallbackGET } from "@/app/api/payment/callback/route";
import { NextRequest } from "next/server";
import { detectPaymentGateway } from "@/lib/payment-gateway";
import { createPaymentPage } from "@/lib/integrations/rivhit";

function makeReq(body: unknown, method = "POST", headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/payment", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeCallbackReq(
  body: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost/api/payment/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayment = {
    orderId: "CLM-99999",
    amount: 3999,
    customerName: "Ahmad",
    customerPhone: "0533337653",
    customerCity: "Haifa",
  };

  it("returns payment URL for Rivhit gateway", async () => {
    const res = await POST(makeReq(validPayment));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.paymentUrl).toContain("icredit");
    expect(body.data.provider).toBe("icredit");
  });

  it("returns payment URL for UPay gateway", async () => {
    (detectPaymentGateway as ReturnType<typeof vi.fn>).mockReturnValueOnce("upay");
    const res = await POST(makeReq(validPayment));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.paymentUrl).toContain("upay");
    expect(body.data.provider).toBe("upay");
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await POST(
      makeReq({ amount: 100, customerName: "A", customerPhone: "0533337653" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is missing", async () => {
    const res = await POST(
      makeReq({ orderId: "CLM-99999", customerName: "A", customerPhone: "0533337653" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when payment page creation fails", async () => {
    (createPaymentPage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: "Invalid config",
    });
    const res = await POST(makeReq(validPayment));
    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected error", async () => {
    (createPaymentPage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network")
    );
    const res = await POST(makeReq(validPayment));
    expect(res.status).toBe(500);
  });

  it("respects forceGateway parameter", async () => {
    const res = await POST(
      makeReq({ ...validPayment, forceGateway: "rivhit" })
    );
    const body = await res.json();
    expect(body.data.provider).toBe("icredit");
    expect(detectPaymentGateway).not.toHaveBeenCalled();
  });
});

describe("POST /api/payment/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    // Counter distinguishes the 3 sequential db.from("orders") calls:
    // 1. select(...).eq("id").single()  → existingOrder
    // 2. select("id").neq("id").eq("payment_transaction_id").single()  → dup check
    // 3. select("*,customers(...)").eq("id").maybeSingle()  → order+customer
    let ordersCall = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall++;
        const idx = ordersCall;
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            idx === 1
              ? { data: { id: "CLM-99999", status: "new", payment_status: "pending" }, error: null }
              : { data: null, error: null },
          ),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "CLM-99999", customers: { name: "Ahmad", phone: "0533337653" } },
            error: null,
          }),
        };
        for (const k of ["select", "eq", "neq"]) {
          (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
        }
        return chain;
      }
      return chainable();
    });
  });

  it("processes valid IPN with successful payment", async () => {
    const ipnData = {
      SaleId: "sale-123",
      Custom1: "CLM-99999",
      TransactionAmount: "3999",
      TransactionToken: "tok-abc",
      CardLastFourDigits: "1234",
      NumberOfPayments: "1",
      CustomerTransactionId: "ct-123",
    };
    const res = await CallbackPOST(
      makeCallbackReq(JSON.stringify(ipnData))
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.received).toBe(true);
  });

  it("returns 400 when orderId is missing from IPN", async () => {
    const res = await CallbackPOST(
      makeCallbackReq(JSON.stringify({ SaleId: "sale-123" }))
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when order is not found", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
    }));
    const res = await CallbackPOST(
      makeCallbackReq(JSON.stringify({ Custom1: "CLM-00000", SaleId: "s1" }))
    );
    expect(res.status).toBe(404);
  });

  it("returns already_paid when payment was already processed", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "CLM-99999", status: "approved", payment_status: "paid" },
            error: null,
          }),
        }),
      }),
    }));
    const ipnData = { Custom1: "CLM-99999", SaleId: "sale-123", TransactionAmount: "3999" };
    const res = await CallbackPOST(
      makeCallbackReq(JSON.stringify(ipnData))
    );
    const body = await res.json();
    expect(body.data.note).toBe("already_paid");
  });
});

describe("GET /api/payment/callback", () => {
  it("returns status ok", async () => {
    const res = await CallbackGET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
  });
});
