export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/lib/storage";
import { requireAdmin } from "@/lib/admin/auth";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "لم يتم اختيار ملف" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "الملف أكبر من 10MB" }, { status: 400 });
    }

    const isImage = ALLOWED_IMAGES.includes(file.type);
    const isDoc = ALLOWED_DOCS.includes(file.type);

    if (!isImage && !isDoc) {
      return NextResponse.json({
        success: false,
        error: "نوع غير مدعوم (صور: JPG, PNG, WebP | مستندات: PDF, Word, Excel)",
      }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    let url: string;
    try {
      url = await uploadImage(buffer, file.name, file.type);
    } catch {
      const base64 = btoa(String.fromCharCode(...buffer));
      url = `data:${file.type};base64,${base64}`;
    }

    return NextResponse.json({
      success: true,
      url,
      filename: file.name,
      mime_type: file.type,
      type: isImage ? "image" : "document",
    });
  } catch (err: any) {
    console.error("Inbox upload error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
