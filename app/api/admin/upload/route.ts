
// =====================================================
// ClalMobile — Image Upload API
// Uses lib/storage.ts for Supabase Storage
// Falls back to base64 data URL if Storage unavailable
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/lib/storage";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (!files.length) {
      return apiError("لم يتم اختيار صورة", 400);
    }

    const results: { url: string; name: string }[] = [];

    for (const file of files) {
      if (!ALLOWED.includes(file.type)) {
        return apiError(`نوع غير مدعوم: ${file.name} (JPG, PNG, WebP فقط)`, 400);
      }
      if (file.size > MAX_SIZE) {
        return apiError(`${file.name} أكبر من 5MB`, 400);
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
      return apiSuccess({ url: results[0].url });
    }

    return apiSuccess({ urls: results.map((r) => r.url), results });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    return apiError(errMsg(err, "Unknown error"));
  }
}
