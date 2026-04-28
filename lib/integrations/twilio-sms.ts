// =====================================================
// ClalMobile — Twilio SMS + Verify Provider
// OTP via Twilio Verify API (auto-generate + send + check)
// Fallback: raw SMS via Messages API
// Edge-compatible (no SDK, direct REST)
// =====================================================

import type { SMSProvider } from "./hub";
import { getIntegrationConfig } from "./hub";
import { isOutboundBlocked } from "@/lib/outbound-guard";
import { recordMockOutbound } from "@/lib/outbound-mock";

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const TWILIO_VERIFY_API = "https://verify.twilio.com/v2";

/**
 * Mock verification status for checkTwilioVerification when the guard
 * blocks the call. Twilio returns one of approved/pending/canceled in
 * production; we accept those plus a synthetic "denied" / "error" so a
 * test can simulate every branch.
 */
const VALID_MOCK_VERIFY_STATUSES = new Set([
  "approved",
  "pending",
  "denied",
  "canceled",
  "error",
]);

function readMockVerifyStatus(): string {
  const raw = (process.env.MOCK_TWILIO_VERIFY_RESULT || "approved")
    .trim()
    .toLowerCase();
  return VALID_MOCK_VERIFY_STATUSES.has(raw) ? raw : "approved";
}

/** Read Twilio base credentials */
async function getBaseConfig() {
  const dbCfg = await getIntegrationConfig("sms");
  const accountSid = dbCfg.account_sid || process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = dbCfg.auth_token || process.env.TWILIO_AUTH_TOKEN || "";
  const verifyServiceSid = dbCfg.verify_service_sid || process.env.TWILIO_VERIFY_SERVICE_SID || "";
  const fromNumber = dbCfg.phone_number || process.env.TWILIO_FROM_NUMBER || "";
  const messagingServiceSid = dbCfg.messaging_service_sid || process.env.TWILIO_MESSAGING_SERVICE_SID || "";
  return { accountSid, authToken, verifyServiceSid, fromNumber, messagingServiceSid };
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

/** Basic auth header */
function twilioAuth(sid: string, token: string) {
  return `Basic ${btoa(`${sid}:${token}`)}`;
}

// ==========================================================
// Twilio Verify API — OTP generation + delivery + checking
// ==========================================================

/** Start OTP verification via Twilio Verify (sends code automatically) */
export async function startTwilioVerification(
  phone: string,
  channel: "sms" | "whatsapp" = "sms"
): Promise<{ success: boolean; error?: string }> {
  try {
    const guard = isOutboundBlocked("sms");
    if (guard.blocked && guard.reason) {
      await recordMockOutbound({
        channel: "sms",
        reason: guard.reason,
        to: formatPhoneE164(phone),
        subject: null,
        bodyPreview: `[twilio-verify-start] channel=${channel}`,
        meta: { type: "verify_start", channel },
      });
      return { success: true };
    }

    const { accountSid, authToken, verifyServiceSid } = await getBaseConfig();
    if (!accountSid || !authToken || !verifyServiceSid) {
      return { success: false, error: "Twilio Verify not configured" };
    }

    const body = new URLSearchParams({
      To: formatPhoneE164(phone),
      Channel: channel,
    });

    const res = await fetch(
      `${TWILIO_VERIFY_API}/Services/${verifyServiceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: twilioAuth(accountSid, authToken),
        },
        body: body.toString(),
      }
    );

    const data = await res.json();
    if (res.ok && data.status === "pending") {
      return { success: true };
    }
    console.error("Twilio Verify start error:", data.message || data);
    return { success: false, error: data.message || "Verification start failed" };
  } catch (err: unknown) {
    console.error("Twilio Verify start exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Check OTP code via Twilio Verify */
export async function checkTwilioVerification(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const guard = isOutboundBlocked("sms");
    if (guard.blocked && guard.reason) {
      const status = readMockVerifyStatus();
      await recordMockOutbound({
        channel: "sms",
        reason: guard.reason,
        to: formatPhoneE164(phone),
        subject: null,
        bodyPreview: `[twilio-verify-check] code=${code} mockStatus=${status}`,
        meta: { type: "verify_check", code, mockStatus: status },
      });
      // Twilio's real `approved` is the only success state; everything else
      // — pending/denied/canceled/error — is treated as a failed check.
      return status === "approved"
        ? { success: true }
        : { success: false, error: `mock status: ${status}` };
    }

    const { accountSid, authToken, verifyServiceSid } = await getBaseConfig();
    if (!accountSid || !authToken || !verifyServiceSid) {
      return { success: false, error: "Twilio Verify not configured" };
    }

    const body = new URLSearchParams({
      To: formatPhoneE164(phone),
      Code: code,
    });

    const res = await fetch(
      `${TWILIO_VERIFY_API}/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: twilioAuth(accountSid, authToken),
        },
        body: body.toString(),
      }
    );

    const data = await res.json();
    if (res.ok && data.status === "approved") {
      return { success: true };
    }
    return { success: false, error: "رمز التحقق خاطئ أو منتهي الصلاحية" };
  } catch (err: unknown) {
    console.error("Twilio Verify check exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Check if Twilio Verify service is configured */
export async function isTwilioVerifyConfigured(): Promise<boolean> {
  try {
    const { accountSid, authToken, verifyServiceSid } = await getBaseConfig();
    return !!(accountSid && authToken && verifyServiceSid);
  } catch {
    return false;
  }
}

// ==========================================================
// Twilio Messages API — raw SMS (fallback for non-Verify)
// ==========================================================

export class TwilioSMSProvider implements SMSProvider {
  name = "Twilio SMS";

  async send(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
      const guard = isOutboundBlocked("sms");
      if (guard.blocked && guard.reason) {
        await recordMockOutbound({
          channel: "sms",
          reason: guard.reason,
          to: formatPhoneE164(to),
          subject: null,
          bodyPreview: message,
          meta: { type: "raw_sms" },
        });
        return {
          success: true,
          sid: `SM_mock_${Date.now().toString(36)}`,
        };
      }

      const { accountSid, authToken, fromNumber, messagingServiceSid } = await getBaseConfig();
      if (!accountSid || !authToken) throw new Error("Twilio credentials missing");
      if (!fromNumber && !messagingServiceSid) throw new Error("No From number or Messaging Service");

      const params: Record<string, string> = {
        To: formatPhoneE164(to),
        Body: message,
      };
      if (messagingServiceSid) {
        params.MessagingServiceSid = messagingServiceSid;
      } else {
        params.From = fromNumber;
      }

      const res = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: twilioAuth(accountSid, authToken),
        },
        body: new URLSearchParams(params).toString(),
      });

      const data = await res.json();
      if (res.ok && data.sid) return { success: true, sid: data.sid };

      console.error("Twilio SMS error:", data.message || data);
      return { success: false, error: data.message || "SMS send failed" };
    } catch (err: unknown) {
      console.error("Twilio SMS exception:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
}

/** Standalone helper — send SMS OTP via raw Twilio Messages API */
export async function sendSMSOtp(phone: string, otpCode: string): Promise<{ success: boolean; error?: string }> {
  const provider = new TwilioSMSProvider();
  return provider.send(phone, `رمز التحقق الخاص بك: ${otpCode}\n\nصالح لمدة 5 دقائق.\nClalMobile`);
}

/** Check if raw SMS (Messages API) is configured */
export async function isTwilioConfigured(): Promise<boolean> {
  try {
    const { accountSid, authToken, fromNumber, messagingServiceSid } = await getBaseConfig();
    return !!(accountSid && authToken && (fromNumber || messagingServiceSid));
  } catch {
    return false;
  }
}
