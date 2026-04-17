/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";

// ── Hoisted env setup (runs before imports) ────────────
vi.hoisted(() => {
  process.env.OPENAI_API_KEY_ADMIN = "sk-test-key";
  process.env.REMOVEBG_API_KEY = "removebg-test-key";
});

// ── Mocks ──────────────────────────────────────────────
vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient({ ai_usage: { data: [] } });
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    }),
  };
});

// Mock fetch for OpenAI and remove.bg
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock storage-r2
vi.mock("@/lib/storage-r2", () => ({
  uploadToR2: vi.fn().mockResolvedValue("https://r2.test/enhanced.png"),
}));

// Mock removebg
vi.mock("@/lib/integrations/removebg", () => ({
  removeBackgroundFromBuffer: vi.fn().mockResolvedValue({
    imageBuffer: new ArrayBuffer(1024),
    width: 800,
    height: 600,
  }),
}));

import { POST as aiEnhancePOST } from "@/app/api/admin/ai-enhance/route";
import { GET as aiUsageGET } from "@/app/api/admin/ai-usage/route";
import { POST as imageEnhancePOST } from "@/app/api/admin/image-enhance/route";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";

// ── Tests ──────────────────────────────────────────────
describe("Admin AI APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-install supabase client mock (overrides helper's hoisted vi.mock)
    const client = createMockSupabaseClient({ ai_usage: { data: [] } });
    (createAdminSupabase as any).mockImplementation(() => client);
    (createServerSupabase as any).mockImplementation(() => client);
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/ai-enhance
  // ═══════════════════════════════════════════════
  describe("AI Enhance — /api/admin/ai-enhance POST", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name_ar: "iPhone 16 Pro Max",
                  name_he: "iPhone 16 Pro Max",
                  description_ar: "هاتف ذكي رائع",
                  description_he: "סמארטפון מדהים",
                  type: "device",
                  slug: "iphone-16-pro-max",
                }),
              },
            },
          ],
        }),
        text: async () => "",
      });
    });

    it("returns AI-generated product data", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { name_en: "iPhone 16 Pro Max", brand: "Apple", type: "device" },
      });
      const res = await aiEnhancePOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name_ar).toBeDefined();
      expect(body.data.description_ar).toBeDefined();
    });

    it("returns 400 when name_en is missing", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { brand: "Apple" },
      });
      const res = await aiEnhancePOST(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 when OpenAI API fails", async () => {
      // Mock fetch to fail
      mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" });
      const req = createMockRequest({
        method: "POST",
        body: { name_en: "Test" },
      });
      const res = await aiEnhancePOST(req);

      expect(res.status).toBe(500);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({
        method: "POST",
        body: { name_en: "Test" },
      });
      const res = await aiEnhancePOST(req);

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/ai-usage
  // ═══════════════════════════════════════════════
  describe("AI Usage — /api/admin/ai-usage GET", () => {
    it("returns usage stats with empty data", async () => {
      const req = createMockRequest({ url: "/api/admin/ai-usage" });
      const res = await aiUsageGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("totalRequests");
      expect(body.data).toHaveProperty("totalTokens");
      expect(body.data).toHaveProperty("estimatedCost");
      expect(body.data).toHaveProperty("byFeature");
      expect(body.data).toHaveProperty("daily");
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({ url: "/api/admin/ai-usage" });
      const res = await aiUsageGET(req);

      expect(res.status).toBe(401);
    });

    it("returns 500 when DB client is null", async () => {
      const { createAdminSupabase } = await import("@/lib/supabase");
      (createAdminSupabase as any).mockReturnValueOnce(null);

      const req = createMockRequest({ url: "/api/admin/ai-usage" });
      const res = await aiUsageGET(req);

      expect(res.status).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/image-enhance
  // ═══════════════════════════════════════════════
  describe("Image Enhance — /api/admin/image-enhance POST", () => {
    beforeEach(() => {
      process.env.REMOVEBG_API_KEY = "removebg-test-key";
    });

    it("processes a JSON body with image_url", async () => {
      // Mock fetch for image download
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(100),
      });

      const req = createMockRequest({
        method: "POST",
        body: { image_url: "https://example.com/img.jpg" },
        headers: { "content-type": "application/json" },
      });
      const res = await imageEnhancePOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.url).toBeDefined();
      expect(body.data.width).toBe(800);
      expect(body.data.height).toBe(600);
    });

    it("returns 400 when image_url is missing (JSON mode)", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {},
        headers: { "content-type": "application/json" },
      });
      const res = await imageEnhancePOST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 for unsupported content type", async () => {
      const req = createMockRequest({
        method: "POST",
        headers: { "content-type": "text/plain" },
      });
      const res = await imageEnhancePOST(req);

      expect(res.status).toBe(400);
    });

    it("returns 500 when REMOVEBG_API_KEY is not set", async () => {
      delete process.env.REMOVEBG_API_KEY;
      const req = createMockRequest({
        method: "POST",
        body: { image_url: "https://example.com/img.jpg" },
        headers: { "content-type": "application/json" },
      });
      const res = await imageEnhancePOST(req);

      expect(res.status).toBe(500);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createMockRequest({
        method: "POST",
        body: { image_url: "https://example.com/img.jpg" },
      });
      const res = await imageEnhancePOST(req);

      expect(res.status).toBe(401);
    });
  });
});
