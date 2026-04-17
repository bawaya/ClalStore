
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { apiSuccess, apiError } from "@/lib/api-response";
import { contactSchema, validateBody } from "@/lib/admin/validators";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const raw = await req.json();
    const validation = validateBody(raw, contactSchema);
    if (validation.error) {
      return apiError("بيانات ناقصة أو غير صالحة", 400);
    }
    const { name, phone, email, subject, message } = validation.data!;

    await notifyAdminContactForm({
      name,
      phone,
      email: email ?? undefined,
      subject,
      message,
    });

    return apiSuccess(null);
  } catch (err) {
    console.error("Contact notify error:", err);
    return apiError("تعذّر إرسال الإشعار", 500);
  }
}
