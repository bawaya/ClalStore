/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeUser } from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const user = makeUser({ id: "u1", name: "Admin User", email: "admin@test.com", role: "super_admin", auth_id: "auth-1" });

// ── Mocks ─────────────────────────────────────────────
const mockGetCRMUsers = vi.fn().mockResolvedValue([user]);
const mockUpdateUser = vi.fn().mockResolvedValue(undefined);
const mockGetAuditLog = vi.fn().mockResolvedValue([]);
const mockLogAction = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/crm/queries", () => ({
  getCRMUsers: (...args: any[]) => mockGetCRMUsers(...args),
  updateUser: (...args: any[]) => mockUpdateUser(...args),
  getAuditLog: (...args: any[]) => mockGetAuditLog(...args),
}));

vi.mock("@/lib/admin/queries", () => ({
  logAction: (...args: any[]) => mockLogAction(...args),
}));

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteUrl: vi.fn().mockReturnValue("https://clalmobile.com"),
}));

vi.mock("@/lib/integrations/hub", () => ({
  getProvider: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/bot/whatsapp", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppTemplate: vi.fn().mockResolvedValue(undefined),
}));

const supabaseClient = createMockSupabaseClient({
  users: { data: [user] },
});

// Add admin auth functions to mock
(supabaseClient.auth as any).admin = {
  createUser: vi.fn().mockResolvedValue({
    data: { user: { id: "new-auth-id" } },
    error: null,
  }),
  deleteUser: vi.fn().mockResolvedValue({ error: null }),
};

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "auth-1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    }),
  };
});

// ── Imports ───────────────────────────────────────────
import { GET, POST, PUT, DELETE } from "@/app/api/crm/users/route";

// ── Tests ─────────────────────────────────────────────

describe("CRM Users — /api/crm/users", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns users list", async () => {
      const req = createMockRequest({ url: "/api/crm/users" });
      const res = await GET(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetCRMUsers).toHaveBeenCalled();
    });

    it("returns audit log when audit=true", async () => {
      const req = createMockRequest({
        url: "/api/crm/users",
        searchParams: { audit: "true", limit: "25" },
      });
      const res = await GET(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(mockGetAuditLog).toHaveBeenCalledWith(25);
    });
  });

  describe("POST", () => {
    it("creates a new user", async () => {
      // No existing user with that email
      supabaseClient.from("users").single.mockResolvedValueOnce({ data: null, error: null });
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/users",
        body: { name: "New User", email: "new@test.com", phone: "0509999999", role: "sales" },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.tempPassword).toBeDefined();
    });

    it("returns 400 without name", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/users",
        body: { email: "test@test.com" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/users",
        body: { name: "Test", email: "invalid" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid role", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/users",
        body: { name: "Test", email: "test@test.com", role: "hacker" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate email", async () => {
      supabaseClient.from("users").single.mockResolvedValueOnce({ data: { id: "existing" }, error: null });
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/users",
        body: { name: "Dup", email: "admin@test.com" },
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
    });
  });

  describe("PUT", () => {
    it("updates a user", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/users",
        body: { id: "u1", name: "Updated Name" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith("u1", expect.objectContaining({ name: "Updated Name" }));
    });

    it("returns 400 without id", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/users",
        body: { name: "No ID" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("deletes a user", async () => {
      supabaseClient.from("users").single.mockResolvedValueOnce({
        data: { auth_id: "auth-other", name: "Other User", email: "other@test.com" },
        error: null,
      });
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/users",
        body: { id: "u2" },
      });
      const res = await DELETE(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 without id", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/users",
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent user", async () => {
      supabaseClient.from("users").single.mockResolvedValueOnce({ data: null, error: null });
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/users",
        body: { id: "missing" },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });

    it("returns 400 when deleting yourself", async () => {
      supabaseClient.from("users").single.mockResolvedValueOnce({
        data: { auth_id: "auth-1", name: "Admin", email: "admin@test.com" },
        error: null,
      });
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/users",
        body: { id: "u1" },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
