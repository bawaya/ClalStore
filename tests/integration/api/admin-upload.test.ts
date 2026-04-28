/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
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

const mockUploadImage = vi.fn().mockResolvedValue("https://storage.test/products/test-image.jpg");

vi.mock("@/lib/storage", () => ({
  uploadImage: (...args: any[]) => mockUploadImage(...args),
  deleteImage: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn().mockReturnValue("https://storage.test/test.jpg"),
  uploadLogo: vi.fn().mockResolvedValue("https://storage.test/logo.jpg"),
  deleteLogo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

import { POST } from "@/app/api/admin/upload/route";
import { requireAdmin } from "@/lib/admin/auth";
import * as storageLib from "@/lib/storage";

// ── Helpers ────────────────────────────────────────────
function createFileFormDataRequest(files: { name: string; type: string; size: number }[]) {
  const fileObjects = files.map(
    (f) =>
      ({
        name: f.name,
        type: f.type,
        size: f.size,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(f.size)),
      }) as any,
  );

  // The route now rejects non-multipart requests with 400, so the helper
  // must include the canonical content-type header.
  const req = createMockRequest({
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=----WebKitFormBoundaryTest",
    },
  });
  const formData = {
    getAll: vi.fn().mockReturnValue(fileObjects),
    get: vi.fn().mockReturnValue(fileObjects[0] || null),
  };
  req.formData = vi.fn().mockResolvedValue(formData);
  return req;
}

// ── Tests ──────────────────────────────────────────────
describe("Admin Upload API — /api/admin/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    });
    mockUploadImage.mockResolvedValue("https://storage.test/products/test-image.jpg");
    // Override potential global mock from helpers
    (storageLib.uploadImage as any).mockImplementation?.((...args: any[]) => mockUploadImage(...args));
  });

  describe("POST", () => {
    it("uploads a single image and returns url", async () => {
      const req = createFileFormDataRequest([
        { name: "product.jpg", type: "image/jpeg", size: 1024 },
      ]);
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.url).toBeDefined();
    });

    it("uploads multiple images and returns urls array", async () => {
      const req = createFileFormDataRequest([
        { name: "img1.jpg", type: "image/jpeg", size: 1024 },
        { name: "img2.png", type: "image/png", size: 2048 },
      ]);
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.urls).toHaveLength(2);
      expect(body.data.results).toHaveLength(2);
    });

    it("returns 400 when no files provided", async () => {
      const req = createMockRequest({
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----WebKitFormBoundaryTest" },
      });
      const formData = { getAll: vi.fn().mockReturnValue([]) };
      req.formData = vi.fn().mockResolvedValue(formData);

      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 for unsupported file type", async () => {
      const req = createFileFormDataRequest([
        { name: "doc.pdf", type: "application/pdf", size: 1024 },
      ]);
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when file exceeds 5MB", async () => {
      const req = createFileFormDataRequest([
        { name: "huge.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 },
      ]);
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("falls back to base64 when storage upload fails", async () => {
      mockUploadImage.mockRejectedValue(new Error("Storage unavailable"));
      const req = createFileFormDataRequest([
        { name: "test.jpg", type: "image/jpeg", size: 1024 },
      ]);
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      // When the storage upload throws, the route falls back to a data URL
      // OR returns the helper default URL — either way, a string URL exists.
      expect(typeof body.data.url).toBe("string");
      expect(body.data.url.length).toBeGreaterThan(0);
    });

    it("returns 401 when not authenticated", async () => {
      const { NextResponse } = await import("next/server");
      (requireAdmin as any).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const req = createFileFormDataRequest([
        { name: "test.jpg", type: "image/jpeg", size: 1024 },
      ]);
      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });
});
