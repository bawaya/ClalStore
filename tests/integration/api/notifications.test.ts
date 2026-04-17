import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Mocks ---
const { mockFrom, mockRequireAdmin } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

import { GET, POST, PATCH } from "@/app/api/notifications/route";
import { NextRequest } from "next/server";

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data : [], error }),
  };
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "function" && !["single", "then"].includes(k)) {
      (obj[k] as ReturnType<typeof vi.fn>).mockReturnValue(obj);
    }
  }
  return obj;
}

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

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("returns notifications for admin", async () => {
    const notifications = [
      { id: "n1", title: "New order", read: false },
      { id: "n2", title: "Payment received", read: true },
    ];

    const chain = chainable(notifications);
    chain.limit = vi.fn().mockResolvedValue({ data: notifications, error: null });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeReq("/api/notifications"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.notifications).toBeDefined();
    expect(body.data.unreadCount).toBeDefined();
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(makeReq("/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("filters by user_id when provided", async () => {
    const chain = chainable([]);
    chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await GET(makeReq("/api/notifications?user_id=user-1"));
    expect(mockFrom).toHaveBeenCalledWith("notifications");
  });

  it("returns 500 on DB error", async () => {
    const chain = chainable(null, { message: "DB error" });
    chain.limit = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeReq("/api/notifications"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("creates a notification", async () => {
    const chain = chainable({ id: "n-new", title: "Test", type: "info" });
    chain.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "n-new", title: "Test", type: "info" },
          error: null,
        }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeReq("/api/notifications", "POST", {
        type: "info",
        title: "Test Notification",
        body: "This is a test",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(
      makeReq("/api/notifications", "POST", { type: "info" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is missing", async () => {
    const res = await POST(
      makeReq("/api/notifications", "POST", { title: "Test" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );
    const res = await POST(
      makeReq("/api/notifications", "POST", { type: "info", title: "Test" })
    );
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("marks single notification as read", async () => {
    const chain = chainable();
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await PATCH(
      makeReq("/api/notifications", "PATCH", { id: "n1" })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("marks all notifications as read for a user", async () => {
    const chain = chainable();
    chain.update = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await PATCH(
      makeReq("/api/notifications", "PATCH", {
        mark_all: true,
        user_id: "user-1",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 when neither id nor mark_all provided", async () => {
    const res = await PATCH(
      makeReq("/api/notifications", "PATCH", {})
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );
    const res = await PATCH(
      makeReq("/api/notifications", "PATCH", { id: "n1" })
    );
    expect(res.status).toBe(401);
  });
});
