// =====================================================
// ClalMobile — Image Upload API
// Uses lib/storage.ts for Supabase Storage
// Falls back to base64 data URL if Storage unavailable
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/lib/storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "لم يتم اختيار صورة" }, { status: 400 });
    }

    const results: { url: string; name: string }[] = [];

    for (const file of files) {
      if (!ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: `نوع غير مدعوم: ${file.name} (JPG, PNG, WebP فقط)` }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `${file.name} أكبر من 5MB` }, { status: 400 });
      }

      // Try Supabase Storage first, fallback to base64
      let url: string | null = null;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        url = await uploadImage(buffer, file.name, file.type);
      } catch {
        // Supabase Storage not available — use base64 fallback
      }

      // Fallback: convert to base64 data URL
      if (!url) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        url = `data:${file.type};base64,${base64}`;
      }

      results.push({ url, name: file.name });
    }

    if (results.length === 1) {
      return NextResponse.json({ success: true, url: results[0].url });
    }

    return NextResponse.json({ success: true, urls: results.map((r) => r.url), results });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
