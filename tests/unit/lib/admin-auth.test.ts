/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ────────────────────────────────────────────────────────────
// Hoisted mocks — captured BEFORE any imports resolve.
// vi.mock() is hoisted to the top of the file by Vitest, so any
// identifier the factory references must be declared via vi.hoisted().
// ────────────────────────────────────────────────────────────

const { hoistedCreateServerClient, hoistedAdminSupabase } = vi.hoisted(() => ({
  hoistedCreateServerClient: vi.fn(),
  hoistedAdminSupabase: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (url: string, key: string, opts: any) =>
    hoistedCreateServerClient(url, key, opts),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: () => hoistedAdminSupabase(),
  createServerSupabase: () => hoistedAdminSupabase(),
  createBrowserSupabase: () => hoistedAdminSupabase(),
  getSupabase: () => hoistedAdminSupabase(),
}));

import {
  hasPermission,
  requireAdmin,
  withAdminAuth,
  withPermission,
  logAudit,
} from "@/lib/admin/auth";
import { createMockRequest } from "@/tests/helpers";

// ────────────────────────────────────────────────────────────
// Fixtures & helpers
// ────────────────────────────────────────────────────────────

interface AuthSetupOpts {
  /** Supabase auth.getUser() result */
  authUser?: { id: string; email?: string; user_metadata?: Record<string, any> } | null;
  authError?: Error | null;
  /** users-table lookup (single) */
  dbUser?: { id: string; name: string; role: string; status: string } | null;
  dbUserError?: Error | null;
  /** users-table count(*) — only consulted when dbUser is null */
  userCount?: number;
  /** users-table insert() (bootstrap) */
  bootstrapResult?: { id: string; name: string } | null;
  /** force createAdminSupabase() → null (e.g. misconfigured env) */
  adminDbNull?: boolean;
}

function setupAuth(opts: AuthSetupOpts = {}) {
  const {
    authUser = { id: "auth-1", email: "admin@test.com" },
    authError = null,
    dbUser = { id: "app-1", name: "Admin", role: "super_admin", status: "active" },
    dbUserError = null,
    userCount = 1,
    bootstrapResult = null,
    adminDbNull = false,
  } = opts;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";

  hoistedCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },
  });

  if (adminDbNull) {
    hoistedAdminSupabase.mockReturnValue(null);
    return;
  }

  // Two separate builder chains: one for select().single(), one for count().head, one for insert()
  const singleChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: dbUser, error: dbUserError }),
  };

  const countChain = {
    select: vi.fn().mockResolvedValue({ count: userCount, data: null, error: null }),
  };

  const insertChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: bootstrapResult, error: null }),
  };

  let fromCallIndex = 0;
  hoistedAdminSupabase.mockReturnValue({
    from: vi.fn().mockImplementation((_table: string) => {
      const callIndex = fromCallIndex++;
      // Call order inside requireAdmin when dbUser is null:
      //   0: .from("users").select(...).eq(...).single()    ← singleChain
      //   1: .from("users").select("id", { count, head })   ← countChain
      //   2: .from("users").insert({...}).select(...).single() ← insertChain
      if (callIndex === 0) return singleChain;
      if (callIndex === 1) return countChain;
      return insertChain;
    }),
  });
}

function makeAuthedRequest(): any {
  return createMockRequest({
    method: "GET",
    cookies: { "sb-access-token": "mock-jwt" },
  });
}

// ================================================================
// hasPermission — pure function matrix tests (preserved)
// ================================================================

describe("hasPermission", () => {
  describe("super_admin role", () => {
    it("has wildcard access to everything", () => {
      expect(hasPermission("super_admin", "products", "view")).toBe(true);
      expect(hasPermission("super_admin", "products", "create")).toBe(true);
      expect(hasPermission("super_admin", "products", "delete")).toBe(true);
      expect(hasPermission("super_admin", "users", "delete")).toBe(true);
      expect(hasPermission("super_admin", "settings", "edit")).toBe(true);
      expect(hasPermission("super_admin", "anything", "anything")).toBe(true);
    });
  });

  describe("admin role", () => {
    it("can view and manage admin panel", () => {
      expect(hasPermission("admin", "admin", "view")).toBe(true);
      expect(hasPermission("admin", "admin", "manage")).toBe(true);
    });
    it("can perform all product operations", () => {
      expect(hasPermission("admin", "products", "view")).toBe(true);
      expect(hasPermission("admin", "products", "create")).toBe(true);
      expect(hasPermission("admin", "products", "edit")).toBe(true);
      expect(hasPermission("admin", "products", "delete")).toBe(true);
    });
    it("can perform all order operations", () => {
      expect(hasPermission("admin", "orders", "view")).toBe(true);
      expect(hasPermission("admin", "orders", "create")).toBe(true);
      expect(hasPermission("admin", "orders", "edit")).toBe(true);
      expect(hasPermission("admin", "orders", "export")).toBe(true);
    });
    it("can manage commissions", () => {
      expect(hasPermission("admin", "commissions", "view")).toBe(true);
      expect(hasPermission("admin", "commissions", "delete")).toBe(true);
      expect(hasPermission("admin", "commissions", "manage")).toBe(true);
      expect(hasPermission("admin", "commissions", "export")).toBe(true);
    });
    it("can manage CRM", () => {
      expect(hasPermission("admin", "crm", "view")).toBe(true);
      expect(hasPermission("admin", "crm", "create")).toBe(true);
      expect(hasPermission("admin", "crm", "manage")).toBe(true);
    });
    it("can manage users", () => {
      expect(hasPermission("admin", "users", "view")).toBe(true);
      expect(hasPermission("admin", "users", "create")).toBe(true);
      expect(hasPermission("admin", "users", "delete")).toBe(true);
    });
    it("can edit settings", () => {
      expect(hasPermission("admin", "settings", "view")).toBe(true);
      expect(hasPermission("admin", "settings", "edit")).toBe(true);
    });
  });

  describe("sales role", () => {
    it("can view admin panel", () => {
      expect(hasPermission("sales", "admin", "view")).toBe(true);
    });
    it("can view and create commissions but not delete/manage", () => {
      expect(hasPermission("sales", "commissions", "view")).toBe(true);
      expect(hasPermission("sales", "commissions", "create")).toBe(true);
      expect(hasPermission("sales", "commissions", "delete")).toBe(false);
      expect(hasPermission("sales", "commissions", "manage")).toBe(false);
    });
    it("can view/create/edit CRM but not delete", () => {
      expect(hasPermission("sales", "crm", "view")).toBe(true);
      expect(hasPermission("sales", "crm", "create")).toBe(true);
      expect(hasPermission("sales", "crm", "edit")).toBe(true);
      expect(hasPermission("sales", "crm", "delete")).toBe(false);
    });
    it("can view products but not create/edit/delete them", () => {
      expect(hasPermission("sales", "products", "view")).toBe(true);
      expect(hasPermission("sales", "products", "create")).toBe(false);
      expect(hasPermission("sales", "products", "edit")).toBe(false);
      expect(hasPermission("sales", "products", "delete")).toBe(false);
    });
    it("cannot manage users", () => {
      expect(hasPermission("sales", "users", "view")).toBe(false);
      expect(hasPermission("sales", "users", "create")).toBe(false);
      expect(hasPermission("sales", "users", "delete")).toBe(false);
    });
    it("cannot touch settings or integrations", () => {
      expect(hasPermission("sales", "settings", "view")).toBe(false);
      expect(hasPermission("sales", "settings", "edit")).toBe(false);
      expect(hasPermission("sales", "integrations", "view")).toBe(false);
    });
  });

  describe("viewer role", () => {
    it("can view admin/products/orders/crm/commissions/reports/settings/store", () => {
      expect(hasPermission("viewer", "admin", "view")).toBe(true);
      expect(hasPermission("viewer", "products", "view")).toBe(true);
      expect(hasPermission("viewer", "orders", "view")).toBe(true);
      expect(hasPermission("viewer", "crm", "view")).toBe(true);
      expect(hasPermission("viewer", "commissions", "view")).toBe(true);
      expect(hasPermission("viewer", "reports", "view")).toBe(true);
      expect(hasPermission("viewer", "settings", "view")).toBe(true);
      expect(hasPermission("viewer", "store", "view")).toBe(true);
    });
    it("cannot create/edit/delete anything", () => {
      expect(hasPermission("viewer", "products", "create")).toBe(false);
      expect(hasPermission("viewer", "products", "edit")).toBe(false);
      expect(hasPermission("viewer", "products", "delete")).toBe(false);
      expect(hasPermission("viewer", "orders", "create")).toBe(false);
      expect(hasPermission("viewer", "orders", "edit")).toBe(false);
      expect(hasPermission("viewer", "commissions", "create")).toBe(false);
      expect(hasPermission("viewer", "settings", "edit")).toBe(false);
      expect(hasPermission("viewer", "users", "view")).toBe(false);
    });
  });

  describe("unknown and edge cases", () => {
    it("returns false for unknown roles", () => {
      expect(hasPermission("customer", "products", "view")).toBe(false);
      expect(hasPermission("guest", "admin", "view")).toBe(false);
      expect(hasPermission("", "products", "view")).toBe(false);
      expect(hasPermission("SUPER_ADMIN", "products", "view")).toBe(false); // case-sensitive
    });

    it("returns false for non-existent module or action (non-super_admin)", () => {
      expect(hasPermission("admin", "nonexistent", "view")).toBe(false);
      expect(hasPermission("admin", "products", "nonexistent")).toBe(false);
    });

    it("super_admin passes even for unknown module/action", () => {
      expect(hasPermission("super_admin", "nonexistent", "anything")).toBe(true);
    });
  });
});

// ================================================================
// requireAdmin
// ================================================================

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";
  });

  it("returns 503 when SUPABASE env vars are missing", async () => {
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_URL;
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await requireAdmin(makeAuthedRequest());
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(503);
  });

  it("returns 401 when auth.getUser returns no user", async () => {
    setupAuth({ authUser: null });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(401);
  });

  it("returns 401 when auth returns an error", async () => {
    setupAuth({ authUser: null, authError: new Error("JWT expired") });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(401);
  });

  it("returns 403 when user status is 'suspended'", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "X", role: "admin", status: "suspended" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns 403 when user status is 'inactive'", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "X", role: "admin", status: "inactive" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns 403 when role is 'customer' (non-admin)", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "X", role: "customer", status: "active" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns 403 when role is 'viewer' (blocked)", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "X", role: "viewer", status: "active" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns user object with role/appUserId/name for a valid admin", async () => {
    setupAuth({
      authUser: { id: "auth-1", email: "admin@test.com" },
      dbUser: { id: "app-1", name: "The Admin", role: "super_admin", status: "active" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect(res).not.toBeInstanceOf(NextResponse);
    const user = res as any;
    expect(user.id).toBe("auth-1");
    expect(user.email).toBe("admin@test.com");
    expect(user.role).toBe("super_admin");
    expect(user.appUserId).toBe("app-1");
    expect(user.name).toBe("The Admin");
  });

  it("falls back to user.email prefix when DB name is missing", async () => {
    setupAuth({
      authUser: { id: "auth-1", email: "jane@test.com" },
      dbUser: { id: "app-1", name: "", role: "admin", status: "active" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as any).name).toBe("jane");
  });

  it("uses user_metadata.full_name when DB name is missing and email is missing", async () => {
    setupAuth({
      authUser: { id: "auth-1", user_metadata: { full_name: "From Metadata" } },
      dbUser: { id: "app-1", name: "", role: "admin", status: "active" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as any).name).toBe("From Metadata");
  });

  it("bootstraps the first user when users table is empty (count = 0)", async () => {
    setupAuth({
      authUser: { id: "auth-new", email: "first@test.com", user_metadata: { full_name: "First User" } },
      dbUser: null,
      userCount: 0,
      bootstrapResult: { id: "boot-1", name: "First User" },
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect(res).not.toBeInstanceOf(NextResponse);
    const user = res as any;
    expect(user.role).toBe("super_admin");
    expect(user.appUserId).toBe("boot-1");
    expect(user.name).toBe("First User");
  });

  it("returns 403 when no DB user exists and users table is non-empty", async () => {
    setupAuth({
      authUser: { id: "auth-imposter", email: "hacker@test.com" },
      dbUser: null,
      userCount: 5, // table has real admins already; this person isn't one of them
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect((res as NextResponse).status).toBe(403);
  });

  it("falls back to super_admin shortcut when admin DB is unavailable", async () => {
    setupAuth({
      authUser: { id: "auth-1", email: "admin@test.com" },
      adminDbNull: true,
    });
    const res = await requireAdmin(makeAuthedRequest());
    expect(res).not.toBeInstanceOf(NextResponse);
    expect((res as any).role).toBe("super_admin");
  });
});

// ================================================================
// withAdminAuth
// ================================================================

describe("withAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards req/db/user to the handler on success", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "Admin", role: "admin", status: "active" },
    });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const route = withAdminAuth(handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const [, , user] = handler.mock.calls[0];
    expect(user.role).toBe("admin");
    expect(user.appUserId).toBe("app-1");
  });

  it("short-circuits with the NextResponse from requireAdmin when auth fails", async () => {
    setupAuth({ authUser: null });
    const handler = vi.fn();
    const route = withAdminAuth(handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 500 when admin DB client is unavailable", async () => {
    // Auth succeeds, but when withAdminAuth calls createAdminSupabase() the
    // second time it returns null. Simulate by using adminDbNull AFTER the
    // requireAdmin path succeeded via its own fallback.
    // Simplest shape: auth succeeds with fallback (admin DB null both times).
    setupAuth({ adminDbNull: true });

    const handler = vi.fn();
    const route = withAdminAuth(handler);
    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
  });

  it("catches handler exceptions and returns 500", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "Admin", role: "admin", status: "active" },
    });

    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const route = withAdminAuth(handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ================================================================
// withPermission
// ================================================================

describe("withPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the handler when user has the required permission", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "Admin", role: "admin", status: "active" },
    });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const route = withPermission("products", "create", handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when user role lacks the permission", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "Sami", role: "sales", status: "active" },
    });

    const handler = vi.fn();
    const route = withPermission("products", "delete", handler); // sales cannot delete products

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when sales tries commissions.delete", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "Sami", role: "sales", status: "active" },
    });

    const handler = vi.fn();
    const route = withPermission("commissions", "delete", handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("super_admin bypasses all permission checks (wildcard)", async () => {
    setupAuth({
      dbUser: { id: "app-1", name: "Root", role: "super_admin", status: "active" },
    });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    // Even a made-up permission should pass for super_admin
    const route = withPermission("anything_exotic", "whatever", handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("propagates the auth failure before reaching the permission check", async () => {
    setupAuth({ authUser: null });
    const handler = vi.fn();
    const route = withPermission("products", "view", handler);

    const res = await route(makeAuthedRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ================================================================
// logAudit
// ================================================================

describe("logAudit", () => {
  it("inserts a row with every field populated", async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const db: any = { from: vi.fn().mockReturnValue({ insert: insertMock }) };

    await logAudit(db, {
      userId: "u-1",
      userName: "Admin",
      userRole: "super_admin",
      action: "delete",
      module: "products",
      entityType: "product",
      entityId: "p-1",
      details: { reason: "duplicate" },
      ipAddress: "1.2.3.4",
    });

    expect(db.from).toHaveBeenCalledWith("audit_log");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: "u-1",
      user_name: "Admin",
      user_role: "super_admin",
      action: "delete",
      module: "products",
      entity_type: "product",
      entity_id: "p-1",
      details: { reason: "duplicate" },
      ip_address: "1.2.3.4",
    });
  });

  it("nulls out optional fields when they are omitted", async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const db: any = { from: vi.fn().mockReturnValue({ insert: insertMock }) };

    await logAudit(db, { action: "create", module: "orders" });

    const payload = insertMock.mock.calls[0][0];
    expect(payload.user_id).toBeNull();
    expect(payload.user_name).toBeNull();
    expect(payload.user_role).toBeNull();
    expect(payload.entity_type).toBeNull();
    expect(payload.entity_id).toBeNull();
    expect(payload.details).toBeNull();
    expect(payload.ip_address).toBeNull();
    expect(payload.action).toBe("create");
    expect(payload.module).toBe("orders");
  });

  it("silently swallows DB errors (never throws on the caller)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const insertMock = vi.fn().mockRejectedValue(new Error("RLS denied"));
    const db: any = { from: vi.fn().mockReturnValue({ insert: insertMock }) };

    await expect(
      logAudit(db, { action: "x", module: "y" }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("never blocks — even if the db itself is malformed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const db: any = {
      from: () => {
        throw new Error("DB unreachable");
      },
    };

    await expect(
      logAudit(db, { action: "test", module: "unit" }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
