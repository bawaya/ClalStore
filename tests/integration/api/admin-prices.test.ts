/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeProduct } from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const product = makeProduct({
  id: "p1",
  brand: "Apple",
  name_ar: "iPhone 15",
  name_en: "iPhone 15",
  type: "device",
  variants: [{ storage: "128GB", price: 3499 }, { storage: "256GB", price: 3999 }],
  storage_options: ["128GB", "256GB"],
});

// ── Supabase mock ─────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  products: { data: [product] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    }),
  };
});

vi.mock("@/lib/admin/queries", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock global fetch for price match (OpenAI)
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{
      message: { content: "iPhone 15 || 128GB || 3000 || 100 || p1 || 128GB || exact || Apple" },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 500, completion_tokens: 100 },
  }),
  text: async () => "",
});
vi.stubGlobal("fetch", mockFetch);

// ── Imports ───────────────────────────────────────────
import { POST as applyPrices } from "@/app/api/admin/prices/apply/route";
import { POST as matchPrices } from "@/app/api/admin/prices/match/route";
import { POST as matchDirect } from "@/app/api/admin/prices/match-direct/route";

// ── Tests ─────────────────────────────────────────────

describe("Admin Prices Apply — POST /api/admin/prices/apply", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies price updates to existing products", async () => {
    supabaseClient.from("products").single.mockResolvedValueOnce({ data: product, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/apply",
      body: {
        updates: [{ productId: "p1", variantStorage: "128GB", newPrice: 3299 }],
      },
    });
    const res = await applyPrices(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBeDefined();
  });

  it("creates new products from PDF", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/apply",
      body: {
        creates: [{
          pdfDeviceName: "Galaxy S26",
          pdfStorage: "256GB",
          pdfBrand: "Samsung",
          newPrice: 4500,
        }],
      },
    });
    const res = await applyPrices(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.created).toBeDefined();
  });

  it("returns 400 when no updates or creates", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/apply",
      body: {},
    });
    const res = await applyPrices(req);
    expect(res.status).toBe(400);
  });

  it("handles mixed updates and creates", async () => {
    supabaseClient.from("products").single.mockResolvedValueOnce({ data: product, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/apply",
      body: {
        updates: [{ productId: "p1", variantStorage: "128GB", newPrice: 3199 }],
        creates: [{ pdfDeviceName: "Pixel 9", pdfStorage: "128GB", pdfBrand: "Google", newPrice: 2800 }],
      },
    });
    const res = await applyPrices(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.updated).toBeDefined();
    expect(body.created).toBeDefined();
  });
});

describe("Admin Prices Match — POST /api/admin/prices/match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("matches PDF text to products using AI", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/match",
      body: { pdfText: "iPhone 15 128GB 3000 ILS" },
    });
    const res = await matchPrices(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.rows).toBeDefined();
    expect(body.summary).toBeDefined();
  });

  it("returns 400 for empty PDF text", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/match",
      body: { pdfText: "" },
    });
    const res = await matchPrices(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when no API key", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY_PRICES;
    delete process.env.OPENAI_API_KEY_ADMIN;
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/match",
      body: { pdfText: "iPhone 15 128GB" },
    });
    const res = await matchPrices(req);
    expect(res.status).toBe(500);
  });
});

describe("Admin Prices Match-Direct — POST /api/admin/prices/match-direct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches structured rows to products", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/match-direct",
      body: {
        rows: [
          { brand: "Apple", model: "iPhone 15 128GB", price: 3000, monthlyPrice: 100 },
        ],
      },
    });
    const res = await matchDirect(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.rows).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.provider).toBe("direct");
  });

  it("returns 400 for empty rows", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/match-direct",
      body: { rows: [] },
    });
    const res = await matchDirect(req);
    expect(res.status).toBe(400);
  });

  it("calculates VAT correctly", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/prices/match-direct",
      body: {
        rows: [{ brand: "Apple", model: "iPhone 15 128GB", price: 1000, monthlyPrice: 50 }],
      },
    });
    const res = await matchDirect(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    const row = body.rows[0];
    expect(row.priceWithVat).toBe(1180); // 1000 * 1.18
    expect(row.monthlyPrice).toBe(59); // 50 * 1.18
  });
});
