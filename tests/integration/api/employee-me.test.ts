/**
 * Tests for GET /api/employee/me — returns the authed employee's profile
 * used by SalesPwaShell to render the header name.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ─── Hoisted mocks (must be declared before vi.mock calls) ────────────────────
const hoisted = vi.hoisted(() => ({
  requireEmployeeMock: vi.fn(),
  createAdminSupabaseMock: vi.fn(),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: hoisted.requireEmployeeMock,
}));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: hoisted.createAdminSupabaseMock,
}));

// Build a minimal chainable Supabase stub: .from().select().eq().maybeSingle()
function makeDb(userRow: { phone?: string | null; avatar_url?: string | null } | null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: userRow, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  };
}

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/employee/me");
}

describe("GET /api/employee/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when requireEmployee rejects", async () => {
    hoisted.requireEmployeeMock.mockResolvedValue(
      NextResponse.json({ success: false, error: "not signed in" }, { status: 401 }),
    );

    const { GET } = await import("@/app/api/employee/me/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 500 when DB is unavailable", async () => {
    hoisted.requireEmployeeMock.mockResolvedValue({
      authId: "auth-1",
      appUserId: "user-1",
      role: "sales",
      name: "Ali",
      email: "ali@example.com",
    });
    hoisted.createAdminSupabaseMock.mockReturnValue(null);

    const { GET } = await import("@/app/api/employee/me/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });

  it("returns the employee profile with name and email", async () => {
    hoisted.requireEmployeeMock.mockResolvedValue({
      authId: "auth-1",
      appUserId: "user-1",
      role: "sales",
      name: "Ali Haider",
      email: "ali@example.com",
    });
    hoisted.createAdminSupabaseMock.mockReturnValue(
      makeDb({ phone: "+972555555555", avatar_url: null }),
    );

    const { GET } = await import("@/app/api/employee/me/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("user-1");
    expect(body.data.name).toBe("Ali Haider");
    expect(body.data.email).toBe("ali@example.com");
    expect(body.data.role).toBe("sales");
    expect(body.data.phone).toBe("+972555555555");
    expect(body.data.avatarUrl).toBeNull();
  });

  it("tolerates missing phone/avatar columns", async () => {
    hoisted.requireEmployeeMock.mockResolvedValue({
      authId: "auth-1",
      appUserId: "user-1",
      role: "admin",
      name: "Admin User",
      email: "admin@example.com",
    });
    // DB returns null row
    hoisted.createAdminSupabaseMock.mockReturnValue(makeDb(null));

    const { GET } = await import("@/app/api/employee/me/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Admin User");
    expect(body.data.phone).toBeNull();
    expect(body.data.avatarUrl).toBeNull();
  });

  it("recovers if the users SELECT throws", async () => {
    hoisted.requireEmployeeMock.mockResolvedValue({
      authId: "auth-1",
      appUserId: "user-1",
      role: "sales",
      name: "Ali",
      email: "ali@example.com",
    });
    // Make maybeSingle reject to simulate column missing / SQL error
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error("column avatar_url does not exist")),
    };
    hoisted.createAdminSupabaseMock.mockReturnValue({ from: vi.fn().mockReturnValue(chain) });

    const { GET } = await import("@/app/api/employee/me/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Ali");
    expect(body.data.phone).toBeNull();
    expect(body.data.avatarUrl).toBeNull();
  });
});
