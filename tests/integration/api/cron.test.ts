import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function chainable(data: unknown = null, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/bot/admin-notify", () => ({
  sendDailyReportLink: vi.fn().mockResolvedValue(undefined),
  sendWeeklyReportLink: vi.fn().mockResolvedValue(undefined),
}));

import { POST as BackupPOST } from "@/app/api/cron/backup/route";
import { POST as CleanupPOST } from "@/app/api/cron/cleanup/route";
import { POST as ReportsPOST, GET as ReportsGET } from "@/app/api/cron/reports/route";
import { NextRequest } from "next/server";
import { sendDailyReportLink, sendWeeklyReportLink } from "@/lib/bot/admin-notify";

function makeReq(
  url: string,
  method = "POST",
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

// ============ Backup ============

describe("POST /api/cron/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";

    mockFrom.mockImplementation(() => {
      const chain = chainable();
      // For count queries — select returns a thenable that resolves to a count result.
      // Route does: await supabase.from(t).select("id", { count: "exact", head: true })
      const countThenable: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ count: 42, data: [], error: null }),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      (countThenable.eq as ReturnType<typeof vi.fn>).mockReturnValue(countThenable);
      (countThenable.gte as ReturnType<typeof vi.fn>).mockReturnValue(countThenable);
      (countThenable.lt as ReturnType<typeof vi.fn>).mockReturnValue(countThenable);
      (countThenable.in as ReturnType<typeof vi.fn>).mockReturnValue(countThenable);
      chain.select = vi.fn().mockReturnValue(countThenable);
      return chain;
    });
  });

  it("returns snapshot when authenticated", async () => {
    const res = await BackupPOST(
      makeReq("/api/cron/backup", "POST", undefined, {
        authorization: "Bearer cron-secret-123",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.note).toContain("snapshot");
  });

  it("returns 401 with wrong secret", async () => {
    const res = await BackupPOST(
      makeReq("/api/cron/backup", "POST", undefined, {
        authorization: "Bearer wrong-secret",
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 without authorization header", async () => {
    const res = await BackupPOST(
      makeReq("/api/cron/backup", "POST")
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await BackupPOST(
      makeReq("/api/cron/backup", "POST", undefined, {
        authorization: "Bearer anything",
      })
    );
    expect(res.status).toBe(503);
  });

  it("accepts x-cron-secret header", async () => {
    const res = await BackupPOST(
      makeReq("/api/cron/backup", "POST", undefined, {
        "x-cron-secret": "cron-secret-123",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when DB is unavailable", async () => {
    const { createAdminSupabase } = await import("@/lib/supabase");
    (createAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const res = await BackupPOST(
      makeReq("/api/cron/backup", "POST", undefined, {
        authorization: "Bearer cron-secret-123",
      })
    );
    expect(res.status).toBe(500);
  });
});

// ============ Cleanup ============

describe("POST /api/cron/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
  });

  it("cleans up expired rate limit entries", async () => {
    const chain = chainable();
    chain.delete = vi.fn().mockReturnValue({
      lt: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ error: null, count: 10 }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await CleanupPOST(
      makeReq("/api/cron/cleanup", "POST", undefined, {
        authorization: "Bearer cron-secret-123",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns 401 with wrong secret", async () => {
    const res = await CleanupPOST(
      makeReq("/api/cron/cleanup", "POST", undefined, {
        authorization: "Bearer wrong",
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await CleanupPOST(
      makeReq("/api/cron/cleanup", "POST", undefined, {
        authorization: "Bearer anything",
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 500 when DB is unavailable", async () => {
    const { createAdminSupabase } = await import("@/lib/supabase");
    (createAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const res = await CleanupPOST(
      makeReq("/api/cron/cleanup", "POST", undefined, {
        authorization: "Bearer cron-secret-123",
      })
    );
    expect(res.status).toBe(500);
  });

  it("returns 500 on DB deletion error", async () => {
    const chain = chainable();
    chain.delete = vi.fn().mockReturnValue({
      lt: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ error: { message: "DB error" }, count: null }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    const res = await CleanupPOST(
      makeReq("/api/cron/cleanup", "POST", undefined, {
        authorization: "Bearer cron-secret-123",
      })
    );
    expect(res.status).toBe(500);
  });
});

// ============ Reports ============

describe("POST /api/cron/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
  });

  it("sends daily report link", async () => {
    const res = await ReportsPOST(
      makeReq("/api/cron/reports", "POST", { type: "daily" }, {
        authorization: "Bearer cron-secret-123",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe("daily");
    expect(body.data.sent).toBe(true);
    expect(sendDailyReportLink).toHaveBeenCalledOnce();
  });

  it("sends weekly report link", async () => {
    const res = await ReportsPOST(
      makeReq("/api/cron/reports", "POST", { type: "weekly" }, {
        authorization: "Bearer cron-secret-123",
      })
    );
    const body = await res.json();
    expect(body.data.type).toBe("weekly");
    expect(body.data.sent).toBe(true);
    expect(sendWeeklyReportLink).toHaveBeenCalledOnce();
  });

  it("defaults to daily when type is not specified", async () => {
    const res = await ReportsPOST(
      makeReq("/api/cron/reports", "POST", {}, {
        authorization: "Bearer cron-secret-123",
      })
    );
    const body = await res.json();
    expect(body.data.type).toBe("daily");
    expect(sendDailyReportLink).toHaveBeenCalledOnce();
  });

  it("returns 401 with wrong secret", async () => {
    const res = await ReportsPOST(
      makeReq("/api/cron/reports", "POST", { type: "daily" }, {
        authorization: "Bearer wrong",
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await ReportsPOST(
      makeReq("/api/cron/reports", "POST", { type: "daily" }, {
        authorization: "Bearer anything",
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 500 when send fails", async () => {
    (sendDailyReportLink as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("WhatsApp down")
    );
    const res = await ReportsPOST(
      makeReq("/api/cron/reports", "POST", { type: "daily" }, {
        authorization: "Bearer cron-secret-123",
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/cron/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
  });

  it("sends daily report via secret query param", async () => {
    const res = await ReportsGET(
      makeReq("/api/cron/reports?secret=cron-secret-123&type=daily")
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe("daily");
    expect(sendDailyReportLink).toHaveBeenCalledOnce();
  });

  it("sends weekly report via query param", async () => {
    const res = await ReportsGET(
      makeReq("/api/cron/reports?secret=cron-secret-123&type=weekly")
    );
    const body = await res.json();
    expect(body.data.type).toBe("weekly");
    expect(sendWeeklyReportLink).toHaveBeenCalledOnce();
  });

  it("returns 401 with wrong secret", async () => {
    const res = await ReportsGET(
      makeReq("/api/cron/reports?secret=wrong")
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await ReportsGET(
      makeReq("/api/cron/reports?secret=anything")
    );
    expect(res.status).toBe(503);
  });
});
