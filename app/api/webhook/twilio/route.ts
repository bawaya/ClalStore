
// =====================================================
// ClalMobile — Twilio Webhook (SMS/Verify Status Callbacks)
// POST /api/webhook/twilio
// Handles delivery status updates from Twilio
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyTwilioSignature } from "@/lib/webhook-verify";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Parse form data first (needed for signature verification)
    const contentType = req.headers.get("content-type") || "";
    let data: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      params.forEach((value, key) => {
        data[key] = value;
      });
    } else {
      data = JSON.parse(rawBody);
    }

    // Twilio signature verification: HMAC-SHA1 over (URL + sorted params), base64
    const twilioSignature = req.headers.get("x-twilio-signature");
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (twilioAuthToken) {
      if (!twilioSignature) {
        console.error("Twilio webhook: missing signature header — rejecting");
        return apiError("Missing webhook signature", 401);
      }
      const requestUrl = req.url;
      const valid = await verifyTwilioSignature(requestUrl, data, twilioSignature, twilioAuthToken);
      if (!valid) {
        console.error("Twilio webhook: invalid signature");
        return apiError("Invalid webhook signature", 401);
      }
    }

    // Delivery status callback processed — Twilio expects 200 response
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (err: unknown) {
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
  return apiSuccess({ service: "ClalMobile Twilio Webhook" });
}
