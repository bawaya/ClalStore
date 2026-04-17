import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && !["single", "maybeSingle"].includes(k)) {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/bot/whatsapp", () => ({
  parseWebhook: vi.fn((body: Record<string, unknown>) => {
    if (body.test_empty) return null;
    return {
      from: "972533337653",
      text: body.text || "שלום",
      name: "Ahmad",
      type: "text",
      messageId: "msg-123",
    };
  }),
  handleWhatsAppMessage: vi.fn(async () => ({
    text: "مرحبًا! كيف أقدر أساعدك؟",
    quickReplies: ["المنتجات", "الباقات"],
  })),
  sendBotResponse: vi.fn().mockResolvedValue(undefined),
  normalizePhone: vi.fn((phone: string) => phone.replace(/[-\s+]/g, "")),
}));

vi.mock("@/lib/bot/engine", () => ({
  logBotInteraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhook-verify", () => ({
  verifyWebhookSignature: vi.fn(async () => true),
  verifyTwilioSignature: vi.fn(async () => true),
}));

vi.mock("@/lib/bot/admin-notify", () => ({
  notifyAdminNewMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteUrl: vi.fn(() => "https://clalmobile.com"),
}));

import { GET as WhatsAppGET, POST as WhatsAppPOST } from "@/app/api/webhook/whatsapp/route";
import { GET as TwilioGET, POST as TwilioPOST } from "@/app/api/webhook/twilio/route";
import { NextRequest } from "next/server";
import { parseWebhook } from "@/lib/bot/whatsapp";

function makeReq(
  url: string,
  method = "GET",
  body?: string,
  headers: Record<string, string> = {}
): NextRequest {
  const opts: RequestInit = { method, headers: { ...headers } };
  if (body) {
    opts.body = body;
    if (!headers["Content-Type"]) {
      (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    }
  }
  return new NextRequest(`http://localhost${url}`, opts as any);
}

// ============ WhatsApp Webhook ============

describe("GET /api/webhook/whatsapp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBHOOK_VERIFY_TOKEN = "test-verify-token";
  });

  it("returns challenge on valid verification", async () => {
    const res = await WhatsAppGET(
      makeReq(
        "/api/webhook/whatsapp?token=test-verify-token&challenge=test-challenge"
      )
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("test-challenge");
  });

  it("returns 403 on invalid token", async () => {
    const res = await WhatsAppGET(
      makeReq("/api/webhook/whatsapp?token=wrong-token&challenge=test")
    );
    expect(res.status).toBe(403);
  });

  it("returns OK when no challenge provided", async () => {
    const res = await WhatsAppGET(
      makeReq("/api/webhook/whatsapp?token=test-verify-token")
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("OK");
  });
});

describe("POST /api/webhook/whatsapp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBHOOK_SECRET;
    mockFrom.mockReturnValue(chainable(null));
  });

  it("processes incoming text message", async () => {
    const body = JSON.stringify({ text: "שלום" });
    const res = await WhatsAppPOST(makeReq("/api/webhook/whatsapp", "POST", body));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.received).toBe(true);
  });

  it("returns received:true for empty messages", async () => {
    (parseWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const body = JSON.stringify({ test_empty: true });
    const res = await WhatsAppPOST(makeReq("/api/webhook/whatsapp", "POST", body));
    const json = await res.json();
    expect(json.data.received).toBe(true);
  });

  it("rejects request when WEBHOOK_SECRET is set and no signature", async () => {
    process.env.WEBHOOK_SECRET = "secret-123";

    const body = JSON.stringify({ text: "Hi" });
    const res = await WhatsAppPOST(
      makeReq("/api/webhook/whatsapp", "POST", body)
    );
    expect(res.status).toBe(401);
  });

  it("accepts request with valid signature when secret is set", async () => {
    process.env.WEBHOOK_SECRET = "secret-123";

    const body = JSON.stringify({ text: "Hi" });
    const res = await WhatsAppPOST(
      makeReq("/api/webhook/whatsapp", "POST", body, {
        "x-ycloud-signature": "valid-sig",
      })
    );
    const json = await res.json();
    expect(json.data.received).toBe(true);
  });

  it("returns 500 on processing error", async () => {
    const body = "invalid json {{{";
    const res = await WhatsAppPOST(
      makeReq("/api/webhook/whatsapp", "POST", body)
    );
    expect(res.status).toBe(500);
  });
});

// ============ Twilio Webhook ============

describe("GET /api/webhook/twilio", () => {
  it("returns service info", async () => {
    const res = await TwilioGET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.service).toContain("Twilio");
  });
});

describe("POST /api/webhook/twilio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  it("returns TwiML response for valid request", async () => {
    const body = JSON.stringify({ MessageStatus: "delivered", MessageSid: "SM123" });
    const res = await TwilioPOST(
      makeReq("/api/webhook/twilio", "POST", body)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/xml");
    const text = await res.text();
    expect(text).toContain("<Response>");
  });

  it("handles form-encoded body", async () => {
    const body = "MessageStatus=delivered&MessageSid=SM123";
    const res = await TwilioPOST(
      makeReq("/api/webhook/twilio", "POST", body, {
        "Content-Type": "application/x-www-form-urlencoded",
      })
    );
    expect(res.status).toBe(200);
  });

  it("rejects when auth token is set but signature is missing", async () => {
    process.env.TWILIO_AUTH_TOKEN = "auth-token-123";

    const body = JSON.stringify({ MessageStatus: "delivered" });
    const res = await TwilioPOST(
      makeReq("/api/webhook/twilio", "POST", body)
    );
    expect(res.status).toBe(401);
  });

  it("accepts when auth token is set and signature is valid", async () => {
    process.env.TWILIO_AUTH_TOKEN = "auth-token-123";

    const body = JSON.stringify({ MessageStatus: "delivered" });
    const res = await TwilioPOST(
      makeReq("/api/webhook/twilio", "POST", body, {
        "x-twilio-signature": "valid-sig",
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns TwiML even on error", async () => {
    const body = "not valid anything {{{}}}}}";
    const res = await TwilioPOST(
      makeReq("/api/webhook/twilio", "POST", body)
    );
    // Should return 200 with TwiML even on error
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<Response>");
  });
});
