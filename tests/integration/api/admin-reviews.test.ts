/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeProduct,
  makeProductReview,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const product = makeProduct({ id: "p1", name_ar: "آيفون 15", brand: "Apple", type: "device", specs: { screen: "6.1" } });
const review = makeProductReview({ product_id: "p1" });

// ── Supabase mock ─────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  products: { data: [product] },
  product_reviews: { data: [review] },
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

vi.mock("@/lib/ai/claude", () => ({
  callClaude: vi.fn().mockResolvedValue({
    text: '[{"title":"رائع","body":"هاتف ممتاز"},{"title":"מעולה","body":"מכשיר מצוין"}]',
    json: null,
    tokens: { input: 200, output: 100 },
    duration: 1000,
  }),
}));

// ── Imports ───────────────────────────────────────────
import { POST } from "@/app/api/admin/reviews/generate/route";

// ── Tests ─────────────────────────────────────────────

describe("Admin Reviews Generate — POST /api/admin/reviews/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY_ADMIN = "test-key";
  });

  it("generates reviews for a product", async () => {
    supabaseClient.from("products").single.mockResolvedValueOnce({ data: product, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/reviews/generate",
      body: { product_id: "p1", count: 2 },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBeDefined();
  });

  it("returns 400 without product_id", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/reviews/generate",
      body: { count: 5 },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for count out of range", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/reviews/generate",
      body: { product_id: "p1", count: 100 },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent product", async () => {
    supabaseClient.from("products").single.mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/reviews/generate",
      body: { product_id: "missing", count: 2 },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 500 when AI key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY_ADMIN;
    delete process.env.ANTHROPIC_API_KEY;
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/reviews/generate",
      body: { product_id: "p1", count: 2 },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("supports custom rating distribution", async () => {
    supabaseClient.from("products").single.mockResolvedValueOnce({ data: product, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/reviews/generate",
      body: {
        product_id: "p1",
        count: 3,
        distribution: { star5: 2, star4: 1, star3: 0, star2: 0, star1: 0 },
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
