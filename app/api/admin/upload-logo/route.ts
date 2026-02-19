export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin Logo Upload API
// POST: Upload logo → Supabase "brand" bucket
// DELETE: Remove logo from storage + settings
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { uploadLogo, deleteLogo } from "@/lib/storage";
import { updateSetting } from "@/lib/admin/queries";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "لم يتم إرسال ملف" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadLogo(buffer, file.name, file.type);

    if (!url) {
      return NextResponse.json({ error: "فشل الحصول على رابط الشعار" }, { status: 500 });
    }

    // Save logo_url in settings
    await updateSetting("logo_url", url);

    // Verify it was saved
    const { getAdminSettings } = await import("@/lib/admin/queries");
    const settings = await getAdminSettings();
    if (settings.logo_url !== url) {
      console.error("Logo URL mismatch after save:", { saved: settings.logo_url, expected: url });
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("Upload logo error:", err);
    return NextResponse.json({ error: err.message || "فشل رفع الشعار" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (url) {
      await deleteLogo(url);
    }
    await updateSetting("logo_url", "");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل حذف الشعار" }, { status: 500 });
  }
}
