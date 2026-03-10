export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const { name, phone, email, subject, message } = body;

    if (!name || !phone || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await notifyAdminContactForm({ name, phone, email, subject, message });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact notify error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
