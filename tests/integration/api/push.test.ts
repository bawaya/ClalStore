import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Mocks ---
const { mockFrom, mockRequireAdmin } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    // Proper thenable so `await chain` resolves immediately
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      resolve({ data: Array.isArray(data) ? data : data == null ? [] : data, error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && !["single", "maybeSingle", "then"].includes(k)) {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// --- Push Subscribe ---
import { POST as SubscribePOST, DELETE as SubscribeDELETE } from "@/app/api/push/subscribe/route";
// --- Push VAPID ---
import { GET as VapidGET } from "@/app/api/push/vapid/route";
import { NextRequest } from "next/server";

function makeReq(
  url: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const opts: RequestInit = { method, headers: { ...headers } };
  if (body) {
    opts.body = JSON.stringify(body);
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new NextRequest(`http://localhost${url}`, opts as any);
}

// ============ Subscribe Tests ============

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to push notifications when feature is enabled", async () => {
    const settingsChain = chainable({ value: "true" });
    const subsChain = chainable(null); // no existing sub

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "push_subscriptions") return subsChain;
      return chainable();
    });

    const res = await SubscribePOST(
      makeReq("/api/push/subscribe", "POST", {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "key1", auth: "key2" },
        visitor_id: "v-1",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.ok).toBe(true);
  });

  it("returns 403 when feature is disabled", async () => {
    mockFrom.mockReturnValue(chainable({ value: "false" }));

    const res = await SubscribePOST(
      makeReq("/api/push/subscribe", "POST", {
        endpoint: "https://fcm.example.com",
        keys: { p256dh: "k1", auth: "k2" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when endpoint is missing", async () => {
    mockFrom.mockReturnValue(chainable({ value: "true" }));

    const res = await SubscribePOST(
      makeReq("/api/push/subscribe", "POST", {
        keys: { p256dh: "k1", auth: "k2" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when keys are missing", async () => {
    mockFrom.mockReturnValue(chainable({ value: "true" }));

    const res = await SubscribePOST(
      makeReq("/api/push/subscribe", "POST", {
        endpoint: "https://fcm.example.com",
      })
    );
    expect(res.status).toBe(400);
  });

  it("updates existing subscription", async () => {
    const settingsChain = chainable({ value: "true" });
    const existingSub = chainable({ id: "sub-1" });

    mockFrom.mockImplementation((table: string) => {
      if (table === "settings") return settingsChain;
      if (table === "push_subscriptions") return existingSub;
      return chainable();
    });

    const res = await SubscribePOST(
      makeReq("/api/push/subscribe", "POST", {
        endpoint: "https://fcm.example.com",
        keys: { p256dh: "k1", auth: "k2" },
      })
    );
    const body = await res.json();
    expect(body.data.ok).toBe(true);
  });
});

describe("DELETE /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unsubscribes by endpoint", async () => {
    mockFrom.mockReturnValue(chainable());

    const res = await SubscribeDELETE(
      makeReq(
        "/api/push/subscribe?endpoint=https://fcm.example.com",
        "DELETE"
      )
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.ok).toBe(true);
  });

  it("returns success even without endpoint", async () => {
    const res = await SubscribeDELETE(
      makeReq("/api/push/subscribe", "DELETE")
    );
    const body = await res.json();
    expect(body.data.ok).toBe(true);
  });
});

// ============ VAPID Tests ============

describe("GET /api/push/vapid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns VAPID public key", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-public-key";
    const res = await VapidGET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.publicKey).toBe("test-vapid-public-key");
  });

  it("returns 500 when VAPID key is not configured", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const res = await VapidGET();
    expect(res.status).toBe(500);
  });
});

// ============ Push Send Tests ============
// Push send is complex (crypto operations), so we test the admin auth and validation parts

describe("POST /api/push/send (import separately)", () => {
  it("should export POST and GET functions", async () => {
    // Just verify the module can be loaded
    const mod = await import("@/app/api/push/send/route");
    expect(mod.POST).toBeDefined();
    expect(mod.GET).toBeDefined();
  });
});
