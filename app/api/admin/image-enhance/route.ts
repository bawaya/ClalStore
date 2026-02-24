export const runtime = "edge";

// =====================================================
// ClalMobile — AI Image Enhance API
// POST: Remove background + upload to Supabase Storage
// Uses Remove.bg for background removal
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { removeBackground, removeBackgroundFromBuffer } from "@/lib/integrations/removebg";
import { uploadImage } from "@/lib/storage";

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

      const result = await removeBackground(image_url);
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

    // Upload processed image to Supabase Storage
    const filename = `enhanced-${Date.now()}.png`;
    const bytes = new Uint8Array(resultBuffer);
    const url = await uploadImage(bytes, filename, "image/png");

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
    return NextResponse.json(
      { error: err.message || "Image enhancement failed" },
      { status: 500 }
    );
  }
}
