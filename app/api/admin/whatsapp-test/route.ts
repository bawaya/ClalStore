export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppText, sendWhatsAppTemplate } from "@/lib/bot/whatsapp";
import { requireAdmin } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const legacyAuth = req.headers.get("x-admin-key");
    if (legacyAuth !== process.env.WEBHOOK_VERIFY_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { to, mode, templateName, templateParams, message } = await req.json();

    if (!to) {
      return NextResponse.json({ error: "missing 'to' phone number" }, { status: 400 });
    }

    const adminPhone = process.env.ADMIN_PERSONAL_PHONE || "(not set)";
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID || "(not set)";
    const yCloudKey = process.env.YCLOUD_API_KEY ? "set" : "NOT SET";

    const diagnostics = {
      ADMIN_PERSONAL_PHONE: adminPhone.slice(0, 6) + "***",
      WHATSAPP_PHONE_ID: whatsappPhoneId.slice(0, 6) + "***",
      YCLOUD_API_KEY: yCloudKey,
    };

    if (mode === "template") {
      const name = templateName || "clal_admin_alert";
      const params = templateParams || ["Test notification from ClalMobile"];
      const result = await sendWhatsAppTemplate(to, name, params);
      return NextResponse.json({ ok: true, mode: "template", templateName: name, result, diagnostics });
    }

    const text = message || "Test message from ClalMobile WhatsApp diagnostic";
    const result = await sendWhatsAppText(to, text);
    return NextResponse.json({ ok: true, mode: "text", result, diagnostics });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "Unknown error",
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    }, { status: 500 });
  }
}
