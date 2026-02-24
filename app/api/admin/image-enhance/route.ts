export const runtime = "edge";

// =====================================================
// ClalMobile — AI Image Enhance API
// POST: Remove background + upload to R2 (public URL)
// Uses Remove.bg for background removal
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { removeBackgroundFromBuffer } from "@/lib/integrations/removebg";
import { uploadToR2 } from "@/lib/storage-r2";

/** Detect image MIME type from magic bytes in the buffer */
function detectImageType(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer).slice(0, 12);
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // Default to PNG (safest for Remove.bg)
  return "image/png";
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.REMOVEBG_API_KEY) {
      return NextResponse.json({ error: "REMOVEBG_API_KEY not configured" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") || "";

    let resultBuffer: ArrayBuffer;
    let width = 0;
    let height = 0;

    if (contentType.includes("application/json")) {
      // JSON body with image URL
      const body = await req.json();
      const { image_url } = body;

      if (!image_url) {
        return NextResponse.json({ error: "image_url is required" }, { status: 400 });
      }

      // Download image first, then send as buffer to Remove.bg
      // This avoids "invalid_image_url" errors when Remove.bg can't
      // reach our R2/Supabase URLs directly
      const imgRes = await fetch(image_url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: `فشل تحميل الصورة: ${imgRes.status}`, success: false },
          { status: 400 }
        );
      }
      const imgBuffer = await imgRes.arrayBuffer();
      // Detect actual image type from magic bytes (R2 returns wrong content-type
      // and URLs often have no file extension)
      const imgType = detectImageType(imgBuffer);

      const result = await removeBackgroundFromBuffer(imgBuffer, imgType);
      resultBuffer = result.imageBuffer;
      width = result.width;
      height = result.height;
    } else if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "الملف أكبر من 10MB" }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const result = await removeBackgroundFromBuffer(buffer, file.type);
      resultBuffer = result.imageBuffer;
      width = result.width;
      height = result.height;
    } else {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }

    // Upload processed image to R2 (fallback: Supabase Storage)
    const filename = `enhanced-${Date.now()}.png`;
    const url = await uploadToR2(resultBuffer, filename, "image/png");

    return NextResponse.json({
      success: true,
      url,
      width,
      height,
      size: resultBuffer.byteLength,
      message: "✅ تمت إزالة الخلفية وتحسين الصورة",
    });
  } catch (err: any) {
    console.error("[Image Enhance Error]", err);
    // Return detailed error for debugging
    const detail = err.message || "Image enhancement failed";
    const step = detail.includes("Remove.bg")
      ? "removebg"
      : detail.includes("R2") || detail.includes("Upload")
        ? "upload"
        : "unknown";
    return NextResponse.json(
      { error: detail, step, success: false },
      { status: 500 }
    );
  }
}
