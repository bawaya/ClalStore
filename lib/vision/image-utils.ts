// =====================================================
// Vision feature — shared image utilities
//   • download a remote image to a buffer
//   • detect MIME type from magic bytes
//   • compute SHA-256 hash for dedup
//   • upload to R2 with a sane filename
//   • fetch products that need image work
// =====================================================

import { uploadToR2 } from "@/lib/storage-r2";
import { createAdminSupabase } from "@/lib/supabase";
import type { Product } from "@/types/database";

export interface DownloadedImage {
  buffer: ArrayBuffer;
  contentType: string;
  bytes: number;
  hash: string;
  /** Best-effort dimensions if we could detect; null otherwise. */
  width: number | null;
  height: number | null;
}

const TIMEOUT_MS = 15_000;

/** Download an image with a hard timeout, return buffer + metadata. */
export async function downloadImage(url: string): Promise<DownloadedImage> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Image download ${res.status}: ${url.slice(0, 80)}`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("Empty image body");
  }

  const headerType = res.headers.get("content-type") || "";
  const detected = detectMimeFromBytes(buffer);
  const contentType = detected || (headerType.startsWith("image/") ? headerType : "image/jpeg");

  const hash = await sha256Hex(buffer);
  const dims = detectDimensions(buffer, contentType);

  return {
    buffer,
    contentType,
    bytes: buffer.byteLength,
    hash,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
}

/** Detect MIME type from the first few bytes (magic numbers). */
export function detectMimeFromBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length < 4) return null;

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // AVIF: bytes 4..11 are "ftypavif" or "ftypheic" etc.
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "heic" || brand === "heix" || brand === "mif1") return "image/heic";
  }
  return null;
}

/** Best-effort image dimension detection — handles PNG, JPEG, GIF, WebP. */
export function detectDimensions(
  buffer: ArrayBuffer,
  mime: string,
): { width: number; height: number } | null {
  const view = new DataView(buffer);

  try {
    if (mime === "image/png" && view.byteLength >= 24) {
      // PNG IHDR is at byte 16
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (mime === "image/gif" && view.byteLength >= 10) {
      return {
        width: view.getUint16(6, true),
        height: view.getUint16(8, true),
      };
    }
    if (mime === "image/jpeg") {
      // Walk SOF segments
      let offset = 2;
      while (offset < view.byteLength - 8) {
        if (view.getUint8(offset) !== 0xff) break;
        const marker = view.getUint8(offset + 1);
        const segLen = view.getUint16(offset + 2);
        // SOF markers: C0..CF except C4, C8, CC
        if (
          marker >= 0xc0 && marker <= 0xcf &&
          marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
        ) {
          const height = view.getUint16(offset + 5);
          const width = view.getUint16(offset + 7);
          return { width, height };
        }
        offset += segLen + 2;
      }
    }
    if (mime === "image/webp" && view.byteLength >= 30) {
      // VP8 / VP8L / VP8X chunks at byte 12
      const chunk = String.fromCharCode(
        view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15),
      );
      if (chunk === "VP8X" && view.byteLength >= 30) {
        return {
          width: 1 + ((view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16))),
          height: 1 + ((view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16))),
        };
      }
      if (chunk === "VP8 " && view.byteLength >= 30) {
        return {
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff,
        };
      }
      if (chunk === "VP8L" && view.byteLength >= 25) {
        const b1 = view.getUint8(21);
        const b2 = view.getUint8(22);
        const b3 = view.getUint8(23);
        const b4 = view.getUint8(24);
        return {
          width: 1 + (((b2 & 0x3f) << 8) | b1),
          height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
        };
      }
    }
  } catch {
    // fallthrough
  }
  return null;
}

/** SHA-256 hex digest using Web Crypto. */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Map MIME → file extension. */
export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/heic": "heic",
  };
  return map[mime] || "jpg";
}

/** Download → upload to R2 → return public URL. */
export async function rehostImage(
  remoteUrl: string,
): Promise<{ url: string; bytes: number; hash: string; width: number | null; height: number | null }> {
  const dl = await downloadImage(remoteUrl);
  const ext = extFromMime(dl.contentType);
  const filename = `${Date.now()}-${dl.hash.slice(0, 8)}.${ext}`;
  const url = await uploadToR2(dl.buffer, filename, dl.contentType);
  return { url, bytes: dl.bytes, hash: dl.hash, width: dl.width, height: dl.height };
}

/** Fetch a product by id with the columns the vision tools need. */
export async function getProductForImageWork(id: string): Promise<Product | null> {
  const sb = createAdminSupabase();
  const { data, error } = await sb.from("products").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as Product;
}

/** All products with at least one image attached — for audit pass. */
export async function listProductsWithImages(opts?: {
  limit?: number;
  type?: Product["type"];
}): Promise<Pick<Product, "id" | "type" | "brand" | "name_ar" | "name_he" | "name_en" | "image_url" | "gallery" | "colors">[]> {
  const sb = createAdminSupabase();
  let q = sb
    .from("products")
    .select("id,type,brand,name_ar,name_he,name_en,image_url,gallery,colors")
    .order("created_at", { ascending: false });
  if (opts?.type) q = q.eq("type", opts.type);
  q = q.limit(opts?.limit && opts.limit > 0 ? opts.limit : 1000);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as never;
}
