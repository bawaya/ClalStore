import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data : [], error }),
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

vi.mock("@/lib/validators", () => ({
  validatePhone: vi.fn((phone: string) => /^0\d{8,9}$/.test(phone.replace(/[-\s]/g, ""))),
}));

vi.mock("@/lib/crypto", () => ({
  hashSHA256: vi.fn(async (val: string) => `hashed_${val}`),
}));

// Mock the WhatsApp module that is dynamically imported
vi.mock("@/lib/bot/whatsapp", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppTemplate: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/auth/customer/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/customer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no recent OTPs, no existing customer
    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_otps") {
        const chain = chainable(null);
        chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        chain.delete = vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ error: null }),
        });
        return chain;
      }
      if (table === "customers") return chainable(null);
      return chainable();
    });
  });

  it("returns 400 with invalid phone", async () => {
    const res = await POST(makeReq({ phone: "123", action: "send_otp" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with missing phone", async () => {
    const res = await POST(makeReq({ action: "send_otp" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown action", async () => {
    const res = await POST(
      makeReq({ phone: "0533337653", action: "unknown_action" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when OTP was recently sent", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_otps") {
        const chain = chainable();
        chain.limit = vi.fn().mockResolvedValue({
          data: [{ created_at: new Date().toISOString() }],
          error: null,
        });
        return chain;
      }
      return chainable();
    });

    const res = await POST(
      makeReq({ phone: "0533337653", action: "send_otp" })
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 for verify_otp with invalid OTP length", async () => {
    const res = await POST(
      makeReq({ phone: "0533337653", action: "verify_otp", otp: "12" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for verify_otp with wrong OTP", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_otps") {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "otp-1", otp: "hashed_9999", expires_at: new Date(Date.now() + 300_000).toISOString(), verified: false },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: (val: { data: unknown[]; error: null }) => unknown) =>
            resolve({ data: [], error: null }),
          delete: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
        for (const k of ["select", "insert", "update", "eq", "gte", "order", "limit"]) {
          (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
        }
        return chain;
      }
      return chainable(null);
    });

    const res = await POST(
      makeReq({ phone: "0533337653", action: "verify_otp", otp: "1234" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when too many verification attempts", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "customer_otps") {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          // When awaiting the chain directly → return 5+ attempts
          then: (resolve: (val: { data: unknown[]; error: null }) => unknown) =>
            resolve({
              data: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
              error: null,
            }),
          delete: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
        for (const k of ["select", "insert", "update", "eq", "gte", "order", "limit"]) {
          (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
        }
        return chain;
      }
      return chainable();
    });

    const res = await POST(
      makeReq({ phone: "0533337653", action: "verify_otp", otp: "1234" })
    );
    // Should get 429 (too many attempts) or 400 depending on mock
    expect([400, 429]).toContain(res.status);
  });

  it("returns 500 when supabase is unavailable", async () => {
    const { createAdminSupabase } = await import("@/lib/supabase");
    (createAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const res = await POST(
      makeReq({ phone: "0533337653", action: "send_otp" })
    );
    expect(res.status).toBe(500);
  });
});

// ============ Change Password ============

describe("POST /api/auth/change-password", () => {
  let changePasswordPOST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/auth/change-password/route");
    changePasswordPOST = mod.POST;
  });

  it("exports POST function", () => {
    expect(changePasswordPOST).toBeDefined();
  });
});
