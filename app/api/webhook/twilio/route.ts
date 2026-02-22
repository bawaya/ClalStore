export const runtime = 'edge';

// =====================================================
// ClalMobile — Twilio Webhook (SMS/Verify Status Callbacks)
// POST /api/webhook/twilio
// Handles delivery status updates from Twilio
// =====================================================

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let data: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } else {
      data = await req.json();
    }

    const messageSid = data.MessageSid || data.SmsSid || "";
    const messageStatus = data.MessageStatus || data.SmsStatus || "";
    const to = data.To || "";
    const from = data.From || "";
    const errorCode = data.ErrorCode || "";
    const errorMessage = data.ErrorMessage || "";

    // Log delivery status
    console.log(`[Twilio Webhook] SID=${messageSid} Status=${messageStatus} To=${to} From=${from}${
      errorCode ? ` Error=${errorCode}: ${errorMessage}` : ""
    }`);

    // Twilio expects 200 response
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (err: any) {
    console.error("[Twilio Webhook] Error:", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}

// Twilio may send GET for validation
export async function GET() {
  return NextResponse.json({ ok: true, service: "ClalMobile Twilio Webhook" });
}
