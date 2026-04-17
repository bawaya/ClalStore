/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

/** Simulated yCloud API responses */
export const whatsappMockResponses = {
  sendMessage: {
    id: "wamid.mock123",
    status: "accepted",
    to: "972501234567",
  },
  sendTemplate: {
    id: "wamid.tpl456",
    status: "accepted",
    to: "972501234567",
  },
  deliveryStatus: {
    statuses: [
      { id: "wamid.mock123", status: "delivered", timestamp: Date.now() / 1000 },
    ],
  },
  readStatus: {
    statuses: [
      { id: "wamid.mock123", status: "read", timestamp: Date.now() / 1000 },
    ],
  },
  failedStatus: {
    statuses: [
      {
        id: "wamid.mock123",
        status: "failed",
        timestamp: Date.now() / 1000,
        errors: [{ code: 131026, title: "Rate limit hit" }],
      },
    ],
  },
};

/** Build a webhook body that looks like a yCloud inbound message */
export function makeWhatsAppWebhook(overrides: {
  from?: string;
  text?: string;
  type?: string;
  wabaId?: string;
  timestamp?: number;
} = {}) {
  const {
    from = "972501234567",
    text = "مرحبا",
    type = "text",
    wabaId = "waba-mock",
    timestamp = Math.floor(Date.now() / 1000),
  } = overrides;

  return {
    whatsappInboundMessage: {
      wabaId,
      from,
      to: "972521234567",
      sendTime: new Date(timestamp * 1000).toISOString(),
      type,
      text: type === "text" ? { body: text } : undefined,
      image: type === "image" ? { id: "img-mock", sha256: "abc", mime_type: "image/jpeg" } : undefined,
    },
  };
}

/** Build a webhook body for a delivery-status callback */
export function makeDeliveryWebhook(status: "sent" | "delivered" | "read" | "failed" = "delivered") {
  return {
    whatsappMessageStatus: {
      id: "wamid.mock123",
      status,
      timestamp: new Date().toISOString(),
    },
  };
}

/** Install global fetch mock that returns yCloud-shaped responses */
export function installWhatsAppFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
    const body = init?.body ? JSON.parse(init.body) : {};

    // yCloud send endpoints
    if (typeof url === "string" && url.includes("/messages")) {
      return {
        ok: true,
        status: 200,
        json: async () => whatsappMockResponses.sendMessage,
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
