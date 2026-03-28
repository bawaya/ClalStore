export const runtime = 'edge';

import { NextRequest } from "next/server";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, subject, message } = body;

    if (!name || !phone || !message) {
      return apiError("Missing required fields", 400);
    }

    if (typeof name !== "string" || name.length > 200) {
      return apiError("Invalid name", 400);
    }
    if (typeof phone !== "string" || !/^[\d\s\-+()]{7,20}$/.test(phone)) {
      return apiError("Invalid phone", 400);
    }
    if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return apiError("Invalid email", 400);
    }
    if (typeof message !== "string" || message.length > 5000) {
      return apiError("Message too long", 400);
    }

    await notifyAdminContactForm({ name, phone, email, subject, message });

    return apiSuccess(null);
  } catch (err) {
    console.error("Contact notify error:", err);
    return apiError("Failed to send message", 500);
  }
}
