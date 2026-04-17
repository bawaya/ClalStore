
import { NextRequest } from "next/server";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { apiSuccess, apiError } from "@/lib/api-response";
import { contactSchema, validateBody } from "@/lib/admin/validators";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const validation = validateBody(raw, contactSchema);
    if (validation.error) {
      return apiError("Missing required fields", 400);
    }
    const { name, phone, email, subject, message } = validation.data!;

    await notifyAdminContactForm({ name, phone, email: email ?? undefined, subject, message });

    return apiSuccess(null);
  } catch (err) {
    console.error("Contact notify error:", err);
    return apiError("Failed to send message", 500);
  }
}
