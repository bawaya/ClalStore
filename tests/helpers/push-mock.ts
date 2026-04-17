/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── VAPID keys ─────

export const mockVAPIDKeys = {
  publicKey: "BJxV_mock_vapid_public_key_padding_padding_padding_padding_padding_padding",
  privateKey: "mock_vapid_private_key_padding_padding_padding",
  subject: "mailto:test@clalmobile.com",
};

// ───── WebPush ─────

export function mockWebPushSend(opts: { fail?: boolean } = {}) {
  return vi.fn().mockImplementation(async () =>
    opts.fail
      ? Promise.reject(new Error("WebPush send failed"))
      : { statusCode: 201, body: "", headers: { "content-length": "0" } },
  );
}

export function mockWebPushSubscribe() {
  return {
    endpoint: "https://fcm.test/send/mock-subscription-id",
    expirationTime: null,
    keys: {
      p256dh: "BMock_p256dh_key_padding_padding_padding",
      auth: "mock_auth_secret_padding",
    },
  };
}

export function mockWebPushUnsubscribe() {
  return vi.fn().mockResolvedValue(true);
}

// ───── Install fetch mock ─────

export function installPushFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    const urlStr = typeof url === "string" ? url : "";
    if (urlStr.includes("fcm.googleapis") || urlStr.includes("fcm.test")) {
      return { ok: true, status: 201, text: async () => "" };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
