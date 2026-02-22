// =====================================================
// ClalMobile — Twilio SMS Provider
// SMS sending for OTP, notifications, alerts
// Uses Twilio REST API directly (Edge-compatible, no SDK)
// Supports both From Number and Messaging Service SID
// =====================================================

import type { SMSProvider } from "./hub";
import { getIntegrationConfig } from "./hub";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/** Read Twilio SMS credentials — DB first, env fallback */
async function getTwilioConfig() {
  const dbCfg = await getIntegrationConfig("sms");
  const accountSid = dbCfg.account_sid || process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = dbCfg.auth_token || process.env.TWILIO_AUTH_TOKEN || "";
  const fromNumber = dbCfg.phone_number || process.env.TWILIO_FROM_NUMBER || "";
  const messagingServiceSid = dbCfg.messaging_service_sid || process.env.TWILIO_MESSAGING_SERVICE_SID || "";

  if (!accountSid || !authToken) {
    throw new Error("Twilio SMS config incomplete — need account_sid + auth_token");
  }
  if (!fromNumber && !messagingServiceSid) {
    throw new Error("Twilio SMS config incomplete — need phone_number or messaging_service_sid");
  }
  return { accountSid, authToken, fromNumber, messagingServiceSid };
}

/** Format Israeli phone for international format: 05X → +9725X */
function formatPhoneE164(phone: string): string {
  const clean = phone.replace(/[-\s+]/g, "");
  if (clean.startsWith("9720")) return `+${clean}`;
  if (clean.startsWith("972")) return `+${clean}`;
  if (clean.startsWith("05")) return `+972${clean.slice(1)}`;
  if (clean.startsWith("5") && clean.length === 9) return `+972${clean}`;
  return `+${clean}`;
}

export class TwilioSMSProvider implements SMSProvider {
  name = "Twilio SMS";

  async send(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
      const { accountSid, authToken, fromNumber, messagingServiceSid } = await getTwilioConfig();
      const toFormatted = formatPhoneE164(to);

      // Twilio Messages API — form-urlencoded
      // Use MessagingServiceSid if available, otherwise From number
      const params: Record<string, string> = {
        To: toFormatted,
        Body: message,
      };

      if (messagingServiceSid) {
        params.MessagingServiceSid = messagingServiceSid;
      } else {
        params.From = fromNumber;
      }

      const body = new URLSearchParams(params);

      const res = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: body.toString(),
      });

      const data = await res.json();

      if (res.ok && data.sid) {
        return { success: true, sid: data.sid };
      }

      console.error("Twilio SMS error:", data.message || data);
      return { success: false, error: data.message || "SMS send failed" };
    } catch (err: any) {
      console.error("Twilio SMS exception:", err);
      return { success: false, error: err.message };
    }
  }
}

/** Standalone helper — send SMS OTP via Twilio */
export async function sendSMSOtp(phone: string, otpCode: string): Promise<{ success: boolean; error?: string }> {
  const provider = new TwilioSMSProvider();
  return provider.send(phone, `رمز التحقق الخاص بك: ${otpCode}\n\nصالح لمدة 5 دقائق.\nClalMobile`);
}

/** Check if Twilio SMS is configured */
export async function isTwilioConfigured(): Promise<boolean> {
  try {
    const dbCfg = await getIntegrationConfig("sms");
    const sid = dbCfg.account_sid || process.env.TWILIO_ACCOUNT_SID;
    const token = dbCfg.auth_token || process.env.TWILIO_AUTH_TOKEN;
    const from = dbCfg.phone_number || process.env.TWILIO_FROM_NUMBER;
    const msgSvc = dbCfg.messaging_service_sid || process.env.TWILIO_MESSAGING_SERVICE_SID;
    return !!(sid && token && (from || msgSvc));
  } catch {
    return false;
  }
}
