export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, subject, message } = body;

    if (!name || !phone || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof name !== "string" || name.length > 200) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (typeof phone !== "string" || !/^[\d\s\-+()]{7,20}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }
    if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (typeof message !== "string" || message.length > 5000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    await notifyAdminContactForm({ name, phone, email, subject, message });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact notify error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
