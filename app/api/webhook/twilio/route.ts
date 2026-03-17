export const runtime = 'nodejs';

// =====================================================
// ClalMobile — Twilio Webhook (SMS/Verify Status Callbacks)
// POST /api/webhook/twilio
// Handles delivery status updates from Twilio
// =====================================================

import { NextRequest, NextResponse } from "next/server";

async function verifyTwilioSignature(req: NextRequest, params: Record<string, string>): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // skip if not configured

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = req.url.split("?")[0];
  const paramString = Object.keys(params).sort().reduce((s, k) => s + k + params[k], "");
  const data = url + paramString;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return expected === signature;
}

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

    if (!(await verifyTwilioSignature(req, data))) {
      console.warn("[Twilio Webhook] Invalid signature — request rejected");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const messageSid = data.MessageSid || data.SmsSid || "";
    const messageStatus = data.MessageStatus || data.SmsStatus || "";
    const to = data.To || "";
    const from = data.From || "";
    const errorCode = data.ErrorCode || "";
    const errorMessage = data.ErrorMessage || "";

    // Log delivery status
    console.log(`[Twilio Webhook] SID=${messageSid} Status=${messageStatus}${
      errorCode ? ` Error=${errorCode}` : ""
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
