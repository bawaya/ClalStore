/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeProduct } from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const product = makeProduct({
  id: "p1",
  brand: "Apple",
  name_ar: "آيفون 15",
  name_he: "אייפון 15",
  name_en: "iPhone 15",
  type: "device",
  active: true,
  stock: 10,
  variants: [{ storage: "128GB", price: 3499 }],
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

vi.mock("@/lib/admin/device-data", () => ({
  fetchDeviceData: vi.fn().mockResolvedValue({
    specs: { screen: "6.1", battery: "3349mAh" },
    colors: [{ name_en: "Black", hex: "#000", image: "https://img.test/black.jpg" }],
    images: ["https://img.test/front.jpg"],
  }),
  fetchFromGSMArena: vi.fn().mockResolvedValue({
    colors: [{ name_en: "Black", hex: "#000", image: "https://img.test/black.jpg" }],
    images: ["https://img.test/front.jpg"],
  }),
}));

vi.mock("@/lib/admin/gsmarena", () => ({
  fetchProductData: vi.fn().mockResolvedValue({
    colors: [{ name_en: "Black", image: "https://img.test/black.jpg" }],
  }),
}));

vi.mock("@/lib/storage", () => ({
  uploadImage: vi.fn().mockResolvedValue("https://storage.test/uploaded.jpg"),
}));

// Mock global fetch for Pexels, PaynGo
const mockFetch = vi.fn().mockImplementation(async (url: string) => {
  const urlStr = typeof url === "string" ? url : "";

  // Pexels
  if (urlStr.includes("pexels")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        photos: [{ id: 1, alt: "phone", avg_color: "#000", src: { large: "https://pexels.test/img.jpg", medium: "https://pexels.test/thumb.jpg" } }],
        total_results: 1,
      }),
    };
  }

  // PaynGo
  if (urlStr.includes("payngo")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [{
          name: "סמארטפון iPhone 15 צבע שחור",
          sku: "iphone15-black",
          custom_attributes: [{ attribute_code: "image", value: "/i/p/iphone15.jpg" }],
          media_gallery_entries: [],
        }],
      }),
    };
  }

  return { ok: true, status: 200, json: async () => ({}) };
});
vi.stubGlobal("fetch", mockFetch);

// ── Imports ───────────────────────────────────────────
import { POST as autofill } from "@/app/api/admin/products/autofill/route";
import { GET as exportProducts } from "@/app/api/admin/products/export/route";
import { POST as searchPexels } from "@/app/api/admin/products/pexels/route";
import { POST as colorImage } from "@/app/api/admin/products/color-image/route";
import { POST as bulkColorImages } from "@/app/api/admin/products/bulk-color-images/route";
import { POST as importImage } from "@/app/api/admin/products/import-image/route";
import { POST as distributeStock } from "@/app/api/admin/products/distribute-stock/route";

// ── Tests ─────────────────────────────────────────────

describe("Product Autofill — POST /api/admin/products/autofill", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns device data for a product", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/autofill",
      body: { name: "iPhone 15", brand: "Apple" },
    });
    const res = await autofill(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 400 without name or brand", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/autofill",
      body: { name: "iPhone 15" },
    });
    const res = await autofill(req);
    expect(res.status).toBe(400);
  });
});

describe("Product Export — GET /api/admin/products/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns CSV data", async () => {
    const req = createMockRequest({ url: "/api/admin/products/export" });
    const res = await exportProducts(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    // BOM may be stripped by text() decoding; verify header row exists
    expect(text).toContain("id,type,brand");
    expect(text).toContain("name_ar,name_he,name_en");
  });
});

describe("Pexels Search — POST /api/admin/products/pexels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PEXELS_API_KEY = "test-pexels-key";
  });

  it("returns photos from Pexels", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/pexels",
      body: { query: "iPhone black" },
    });
    const res = await searchPexels(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.photos).toBeDefined();
  });

  it("returns 400 for short query", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/pexels",
      body: { query: "a" },
    });
    const res = await searchPexels(req);
    expect(res.status).toBe(400);
  });

  it("passes color parameter", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/pexels",
      body: { query: "Samsung phone", color: "black" },
    });
    const res = await searchPexels(req);
    expect(res.status).toBe(200);
  });
});

describe("Color Image — POST /api/admin/products/color-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns color-specific image", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/color-image",
      body: { name: "iPhone 15", brand: "Apple", color_en: "Black" },
    });
    const res = await colorImage(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns all colors without color_en", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/color-image",
      body: { name: "iPhone 15", brand: "Apple" },
    });
    const res = await colorImage(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.colors).toBeDefined();
  });

  it("returns 400 without name or brand", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/color-image",
      body: { name: "iPhone 15" },
    });
    const res = await colorImage(req);
    expect(res.status).toBe(400);
  });
});

describe("Bulk Color Images — POST /api/admin/products/bulk-color-images", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches images for multiple colors", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/bulk-color-images",
      body: {
        name: "iPhone 15",
        brand: "Apple",
        colors: [
          { name_ar: "أسود", name_he: "שחור" },
          { name_ar: "أبيض", name_he: "לבן" },
        ],
      },
    });
    const res = await bulkColorImages(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results).toBeDefined();
    expect(body.summary).toBeDefined();
  });

  it("returns 400 without required fields", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/bulk-color-images",
      body: { name: "iPhone 15" },
    });
    const res = await bulkColorImages(req);
    expect(res.status).toBe(400);
  });

  it("skips colors that already have images", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/bulk-color-images",
      body: {
        name: "iPhone 15",
        brand: "Apple",
        colors: [{ name_ar: "أسود", has_image: true }],
      },
    });
    const res = await bulkColorImages(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(0);
  });
});

describe("Import Image — POST /api/admin/products/import-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches PaynGo and returns images", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/import-image",
      body: { query: "iPhone 15" },
    });
    const res = await importImage(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results).toBeDefined();
    expect(body.total).toBeDefined();
  });

  it("supports color_he parameter", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/import-image",
      body: { query: "iPhone 15", color_he: "שחור" },
    });
    const res = await importImage(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for short query", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/import-image",
      body: { query: "a" },
    });
    const res = await importImage(req);
    expect(res.status).toBe(400);
  });
});

describe("Distribute Stock — POST /api/admin/products/distribute-stock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("distributes stock in scarce mode", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/distribute-stock",
      body: { mode: "scarce" },
    });
    const res = await distributeStock(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBeDefined();
    expect(body.mode).toBe("scarce");
  });

  it("distributes stock in abundant mode", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/distribute-stock",
      body: { mode: "abundant" },
    });
    const res = await distributeStock(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid mode", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/distribute-stock",
      body: { mode: "infinite" },
    });
    const res = await distributeStock(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when no active products", async () => {
    supabaseClient.__queryBuilders.get("products")!.__setData([]);
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/products/distribute-stock",
      body: { mode: "medium" },
    });
    const res = await distributeStock(req);
    expect(res.status).toBe(404);
    // restore
    supabaseClient.__queryBuilders.get("products")!.__setData([product]);
  });
});
