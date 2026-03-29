export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

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
