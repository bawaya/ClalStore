export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, subject, message } = body;

    if (!name || !phone || !message) {
      return apiError("Missing fields", 400);
    }

    await notifyAdminContactForm({ name, phone, email, subject, message });

    return apiSuccess(null);
  } catch (err) {
    console.error("Contact notify error:", err);
    return apiError("Failed");
  }
}
