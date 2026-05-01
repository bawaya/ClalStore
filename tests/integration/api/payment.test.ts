import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseChain } from "./_helpers/supabase-mock";

// --- Supabase mock ---
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

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
  const dbOrder = {
    id: "CLM-99999",
    customer_id: "cust-1",
    status: "pending_payment",
    total: 3999,
    payment_status: "awaiting_redirect",
    payment_details: {},
    shipping_city: "Haifa",
    shipping_address: "Main St 1",
    customers: {
      id: "cust-1",
      name: "Ahmad",
      phone: "0533337653",
      email: "ahmad@example.com",
      city: "Haifa",
      address: "Main St 1",
      id_number: null,
    },
  };

  const dbItems = [
    {
      product_name: "iPhone 16",
      price: 3999,
      quantity: 1,
    },
  ];

  function mockPaymentDb(order: unknown = dbOrder, items: unknown = dbItems) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return createSupabaseChain(order);
      if (table === "order_items") return createSupabaseChain(items);
      return createSupabaseChain();
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentDb();
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
    expect(createPaymentPage).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "CLM-99999",
        amount: 3999,
        customerName: "Ahmad",
        customerPhone: "0533337653",
        items: [{ name: "iPhone 16", price: 3999, quantity: 1 }],
      }),
    );
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

  it("rejects a tampered client amount", async () => {
    const res = await POST(makeReq({ ...validPayment, amount: 1 }));
    expect(res.status).toBe(409);
    expect(createPaymentPage).not.toHaveBeenCalled();
  });

  it("passes when the client amount matches the database total", async () => {
    const res = await POST(makeReq(validPayment));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(createPaymentPage).toHaveBeenCalled();
  });

  it("rejects a missing order", async () => {
    mockPaymentDb(null);
    const res = await POST(makeReq(validPayment));
    expect(res.status).toBe(404);
    expect(createPaymentPage).not.toHaveBeenCalled();
  });

  it("rejects payment when the submitted customer factor does not match the order", async () => {
    const res = await POST(makeReq({ ...validPayment, customerPhone: "0500000000" }));
    expect(res.status).toBe(403);
    expect(createPaymentPage).not.toHaveBeenCalled();
  });

  it("reuses a recent payment attempt instead of creating a duplicate gateway page", async () => {
    mockPaymentDb({
      ...dbOrder,
      payment_details: {
        payment_attempt: {
          provider: "icredit",
          amount: 3999,
          payment_url: "https://icredit.rivhit.co.il/pay/existing",
          initiated_at: new Date().toISOString(),
        },
      },
    });

    const res = await POST(makeReq(validPayment));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.reused).toBe(true);
    expect(body.data.paymentUrl).toBe("https://icredit.rivhit.co.il/pay/existing");
    expect(createPaymentPage).not.toHaveBeenCalled();
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

  it("ignores forceGateway and uses the database-derived gateway decision", async () => {
    const res = await POST(
      makeReq({ ...validPayment, forceGateway: "rivhit" })
    );
    const body = await res.json();
    expect(body.data.provider).toBe("icredit");
    expect(detectPaymentGateway).toHaveBeenCalledWith("Haifa");
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
      return createSupabaseChain();
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
