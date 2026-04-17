/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── SendGrid ─────

export const sendGridMockResponses = {
  send: { statusCode: 202, body: "", headers: { "x-message-id": "msg_mock123" } },
  sendTemplate: { statusCode: 202, body: "", headers: { "x-message-id": "msg_tpl_mock" } },
  sendError: { statusCode: 400, body: JSON.stringify({ errors: [{ message: "Invalid email" }] }) },
};

export function mockSendGridSend(opts: { fail?: boolean } = {}) {
  return vi.fn().mockImplementation(async () =>
    opts.fail
      ? Promise.reject(new Error("SendGrid error"))
      : sendGridMockResponses.send,
  );
}

export function mockSendGridSendTemplate(opts: { fail?: boolean } = {}) {
  return vi.fn().mockImplementation(async () =>
    opts.fail
      ? Promise.reject(new Error("SendGrid template error"))
      : sendGridMockResponses.sendTemplate,
  );
}

// ───── Resend ─────

export const resendMockResponses = {
  send: { id: "resend_msg_mock123", from: "noreply@clalmobile.com", to: ["test@test.com"] },
  sendError: { statusCode: 400, name: "validation_error", message: "Invalid email" },
};

export function mockResendSend(opts: { fail?: boolean } = {}) {
  return vi.fn().mockImplementation(async () =>
    opts.fail
      ? Promise.reject(new Error("Resend error"))
      : resendMockResponses.send,
  );
}

// ───── Delivery status ─────

export const emailDeliveryStatus = {
  delivered: { event: "delivered", timestamp: Math.floor(Date.now() / 1000), email: "test@test.com" },
  bounced: { event: "bounce", timestamp: Math.floor(Date.now() / 1000), email: "bad@bad.test", reason: "550 mailbox not found" },
  opened: { event: "open", timestamp: Math.floor(Date.now() / 1000), email: "test@test.com" },
  clicked: { event: "click", timestamp: Math.floor(Date.now() / 1000), email: "test@test.com", url: "https://clalmobile.com" },
  spam: { event: "spamreport", timestamp: Math.floor(Date.now() / 1000), email: "test@test.com" },
};

export function mockEmailDeliveryStatus(type: keyof typeof emailDeliveryStatus = "delivered") {
  return emailDeliveryStatus[type];
}

// ───── fetch mock for email providers ─────

export function installEmailFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    const urlStr = typeof url === "string" ? url : "";
    if (urlStr.includes("sendgrid.com")) {
      return { ok: true, status: 202, json: async () => sendGridMockResponses.send };
    }
    if (urlStr.includes("resend.com")) {
      return { ok: true, status: 200, json: async () => resendMockResponses.send };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
