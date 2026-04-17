import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from "@/app/api/health/route";
import { NextRequest } from "next/server";

function makeReq(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/health", { headers });
}

function setupChain(data: unknown = { key: "test" }, error: unknown = null) {
  const result = { data, error };
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    // Make the chain thenable so `await chain` resolves to the result
    then: (resolve: (r: unknown) => void) => resolve(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HEALTH_CHECK_TOKEN = "test-token";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
    process.env.RIVHIT_API_KEY = "riv-key";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.YCLOUD_API_KEY = "ycloud-key";
    process.env.ANTHROPIC_API_KEY = "anth-key";
    // Set up default chain
    setupChain({ config: { account_sid: "sid", verify_service_sid: "vsid" }, status: "active" });
  });

  it("returns 401 without auth token", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(makeReq("wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when HEALTH_CHECK_TOKEN is not set", async () => {
    delete process.env.HEALTH_CHECK_TOKEN;
    const res = await GET(makeReq("any-token"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid token and all checks pass", async () => {
    process.env.REMOVEBG_API_KEY = "rbg-key";

    const res = await GET(makeReq("test-token"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.checks.database.ok).toBe(true);
    expect(body.data.checks.env.ok).toBe(true);
    expect(body.data.timestamp).toBeDefined();
  });

  it("reports env check as failed when required env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await GET(makeReq("test-token"));
    const body = await res.json();
    expect(body.data.checks.env.ok).toBe(false);
  });

  it("reports database check as failed when DB query fails", async () => {
    setupChain(null, new Error("DB down"));

    const res = await GET(makeReq("test-token"));
    const body = await res.json();
    expect(body.data.checks.database.ok).toBe(false);
  });
});
