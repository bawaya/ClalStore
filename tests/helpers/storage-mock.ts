/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── Supabase Storage mock ─────

export const storageMockResponses = {
  uploadSuccess: {
    data: { path: "products/test-image.jpg" },
    error: null,
  },
  uploadError: {
    data: null,
    error: { message: "Bucket not found" },
  },
  deleteSuccess: {
    data: [{ name: "test-image.jpg" }],
    error: null,
  },
  downloadSuccess: {
    data: new Blob(["fake-image-bytes"], { type: "image/jpeg" }),
    error: null,
  },
  publicUrl: "https://supabase.test/storage/v1/object/public/products/test-image.jpg",
  listFiles: {
    data: [
      { name: "image1.jpg", id: "f1", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: {} },
      { name: "image2.png", id: "f2", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: {} },
    ],
    error: null,
  },
};

// ───── Cloudflare R2 mock ─────

export const r2MockResponses = {
  uploadSuccess: "https://r2.test/products/test-image.jpg",
  uploadError: null,
};

export function installStorageFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
    const urlStr = typeof url === "string" ? url : "";

    // R2 uploads (PUT to Cloudflare)
    if (urlStr.includes("r2.cloudflarestorage") || (init?.method === "PUT" && urlStr.includes("r2"))) {
      return { ok: true, status: 200, text: async () => "" };
    }

    // Supabase storage REST
    if (urlStr.includes("storage/v1")) {
      return {
        ok: true,
        status: 200,
        json: async () => storageMockResponses.uploadSuccess,
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Mock lib/storage module */
export function installStorageModuleMock() {
  vi.mock("@/lib/storage", () => ({
    uploadImage: vi.fn().mockResolvedValue(storageMockResponses.publicUrl),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    getPublicUrl: vi.fn().mockReturnValue(storageMockResponses.publicUrl),
    uploadLogo: vi.fn().mockResolvedValue(storageMockResponses.publicUrl),
    deleteLogo: vi.fn().mockResolvedValue(undefined),
  }));
}

/** Mock lib/storage-r2 module */
export function installR2ModuleMock() {
  vi.mock("@/lib/storage-r2", () => ({
    uploadToR2: vi.fn().mockResolvedValue(r2MockResponses.uploadSuccess),
  }));
}
