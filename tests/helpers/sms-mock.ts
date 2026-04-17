/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── Twilio SMS ─────

export const twilioMockResponses = {
  sendSMS: {
    sid: "SM_mock123",
    status: "queued",
    from: "+15005550006",
    to: "+972501234567",
    body: "Test message",
    dateCreated: new Date().toISOString(),
  },
  sendSMSError: {
    code: 21211,
    message: "Invalid 'To' phone number",
    more_info: "https://www.twilio.com/docs/errors/21211",
    status: 400,
  },
  verifyOTPStart: {
    sid: "VE_mock123",
    status: "pending",
    to: "+972501234567",
    channel: "sms",
    valid: false,
  },
  verifyOTPCheck: {
    sid: "VE_mock123",
    status: "approved",
    valid: true,
  },
  verifyOTPCheckFailed: {
    sid: "VE_mock123",
    status: "denied",
    valid: false,
  },
};

export function mockTwilioSendSMS(opts: { to?: string; body?: string; fail?: boolean } = {}) {
  return vi.fn().mockResolvedValue(
    opts.fail
      ? Promise.reject(new Error("Twilio send failed"))
      : { ...twilioMockResponses.sendSMS, to: opts.to ?? twilioMockResponses.sendSMS.to, body: opts.body ?? twilioMockResponses.sendSMS.body },
  );
}

export function mockTwilioVerifyOTP(opts: { channel?: "sms" | "whatsapp" } = {}) {
  return vi.fn().mockResolvedValue({ ...twilioMockResponses.verifyOTPStart, channel: opts.channel ?? "sms" });
}

export function mockTwilioCheckOTP(opts: { valid?: boolean } = { valid: true }) {
  return vi.fn().mockResolvedValue(
    opts.valid
      ? twilioMockResponses.verifyOTPCheck
      : twilioMockResponses.verifyOTPCheckFailed,
  );
}

/** Inbound Twilio webhook payload */
export function mockTwilioWebhook(overrides: {
  from?: string;
  body?: string;
  messageSid?: string;
} = {}) {
  return {
    MessageSid: overrides.messageSid ?? "SM_mock_incoming",
    SmsSid: overrides.messageSid ?? "SM_mock_incoming",
    AccountSid: "AC_mock",
    From: overrides.from ?? "+972501234567",
    To: "+15005550006",
    Body: overrides.body ?? "مرحبا",
    NumMedia: "0",
    FromCountry: "IL",
    FromState: "",
    FromCity: "",
    SmsStatus: "received",
    ApiVersion: "2010-04-01",
  };
}

/** Install fetch mock for Twilio endpoints */
export function installTwilioFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === "string" && url.includes("twilio.com")) {
      if (url.includes("/Verifications")) {
        return { ok: true, status: 200, json: async () => twilioMockResponses.verifyOTPStart };
      }
      if (url.includes("/VerificationCheck")) {
        return { ok: true, status: 200, json: async () => twilioMockResponses.verifyOTPCheck };
      }
      if (url.includes("/Messages")) {
        return { ok: true, status: 200, json: async () => twilioMockResponses.sendSMS };
      }
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
