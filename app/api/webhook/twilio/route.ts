export const runtime = 'edge';

// =====================================================
// ClalMobile — Twilio Webhook (SMS/Verify Status Callbacks)
// POST /api/webhook/twilio
// Handles delivery status updates from Twilio
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/webhook-verify";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Twilio HMAC-SHA1 signature verification
    const twilioSignature = req.headers.get("x-twilio-signature");
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (twilioAuthToken) {
      if (!twilioSignature) {
        console.error("Twilio webhook: missing signature header — rejecting");
        return apiError("Missing webhook signature", 401);
      }
      const valid = await verifyWebhookSignature(rawBody, twilioSignature, twilioAuthToken, "sha1");
      if (!valid) {
        console.error("Twilio webhook: invalid HMAC signature");
        return apiError("Invalid webhook signature", 401);
      }
    }

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
