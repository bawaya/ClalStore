
// =====================================================
// ClalMobile — Admin Logo Upload API
// POST: Upload logo → Supabase "brand" bucket
// DELETE: Remove logo from storage + settings
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { uploadLogo, deleteLogo } from "@/lib/storage";
import { updateSetting } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return apiError("الطلب يجب أن يكون multipart/form-data", 400);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("لم يتم إرسال ملف", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadLogo(buffer, file.name, file.type);

    if (!url) {
      return apiError("فشل الحصول على رابط الشعار", 500);
    }

    // Save logo_url in settings
    await updateSetting("logo_url", url);

    // Verify it was saved
    const { getAdminSettings } = await import("@/lib/admin/queries");
    const settings = await getAdminSettings();
    if (settings.logo_url !== url) {
      console.error("Logo URL mismatch after save:", { saved: settings.logo_url, expected: url });
    }

    revalidateTag("public-settings");
    revalidatePath("/api/settings/public");

    return apiSuccess({ url });
  } catch (err: unknown) {
    console.error("Upload logo error:", err);
    return apiError("فشل رفع الشعار", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { url } = await req.json();
    if (url) {
      await deleteLogo(url);
    }
    await updateSetting("logo_url", "");

    revalidateTag("public-settings");
    revalidatePath("/api/settings/public");

    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Delete logo error:", err);
    return apiError("فشل حذف الشعار", 500);
  }
}
