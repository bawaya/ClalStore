/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeOrder } from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const order = makeOrder({ id: "CLM-1", status: "new" });

// ── Mocks ─────────────────────────────────────────────
const mockGetCRMOrders = vi.fn().mockResolvedValue({ orders: [order], total: 1 });
const mockAddOrderNote = vi.fn().mockResolvedValue(undefined);
const mockAssignOrder = vi.fn().mockResolvedValue(undefined);
const mockDeleteOrderCompletely = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/crm/queries", () => ({
  getCRMOrders: (...args: any[]) => mockGetCRMOrders(...args),
  addOrderNote: (...args: any[]) => mockAddOrderNote(...args),
  assignOrder: (...args: any[]) => mockAssignOrder(...args),
  deleteOrderCompletely: (...args: any[]) => mockDeleteOrderCompletely(...args),
}));

const mockUpdateOrderStatusWithHistory = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/orders/admin", () => ({
  updateOrderStatusWithHistory: (...args: any[]) => mockUpdateOrderStatusWithHistory(...args),
}));

vi.mock("@/lib/commissions/sync-orders", () => ({
  syncCommissionForOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/bot/notifications", () => ({
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
  sendNoReplyReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/bot/admin-notify", () => ({
  notifyAdminOrderCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email-templates", () => ({
  orderStatusEmail: vi.fn().mockReturnValue({ subject: "test", html: "<p>test</p>" }),
}));

vi.mock("@/lib/integrations/hub", () => ({
  getProvider: vi.fn().mockResolvedValue(null),
}));

const supabaseClient = createMockSupabaseClient({
  orders: { data: [order] },
  customers: { data: [] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: "u1",
    email: "admin@test.com",
    role: "super_admin",
    name: "Admin",
    appUserId: "u1",
  },
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue(mockUser),
    hasPermission: vi.fn().mockReturnValue(true),
    withPermission: vi.fn().mockImplementation(
      (_module: string, _action: string, handler: Function) => {
        return async (req: any, ctx?: any) => handler(req, supabaseClient, mockUser, ctx);
      }
    ),
    withAdminAuth: vi.fn().mockImplementation((handler: Function) => {
      return async (req: any, ctx?: any) => handler(req, supabaseClient, mockUser, ctx);
    }),
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

// ── Imports ───────────────────────────────────────────
import { GET, PUT } from "@/app/api/crm/orders/route";

// ── Tests ─────────────────────────────────────────────

describe("CRM Orders — /api/crm/orders", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns orders list", async () => {
      const req = createMockRequest({ url: "/api/crm/orders" });
      const res = await GET(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetCRMOrders).toHaveBeenCalled();
    });

    it("passes filters", async () => {
      const req = createMockRequest({
        url: "/api/crm/orders",
        searchParams: { status: "new", source: "store", search: "Ahmad" },
      });
      await GET(req);
      expect(mockGetCRMOrders).toHaveBeenCalledWith(
        expect.objectContaining({ status: "new", source: "store", search: "Ahmad" }),
      );
    });
  });

  describe("PUT — status action", () => {
    it("updates order status", async () => {
      supabaseClient.from("orders").single.mockResolvedValueOnce({
        data: { ...order, customers: { name: "Ahmad", phone: "050", email: null } },
        error: null,
      });
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "status", orderId: "CLM-1", status: "approved" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateOrderStatusWithHistory).toHaveBeenCalled();
    });

    it("returns 400 for invalid status", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "status", orderId: "CLM-1", status: "magic" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT — bulk_status action", () => {
    it("updates multiple orders", async () => {
      supabaseClient.from("orders").single.mockResolvedValue({
        data: { ...order, customers: null },
        error: null,
      });
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "bulk_status", ids: ["CLM-1", "CLM-2"], status: "approved" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.updated).toBe(2);
    });

    it("returns 400 for empty ids", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "bulk_status", ids: [], status: "approved" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT — note action", () => {
    it("adds a note", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "note", orderId: "CLM-1", text: "Check delivery" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockAddOrderNote).toHaveBeenCalled();
    });

    it("returns 400 without text", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "note", orderId: "CLM-1", text: "" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT — assign action", () => {
    it("assigns an order", async () => {
      supabaseClient.from("orders").single.mockResolvedValueOnce({
        data: { ...order, customers: null },
        error: null,
      });
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "assign", orderId: "CLM-1", userId: "u1", userName: "Admin" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 without required fields", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "assign", orderId: "CLM-1" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT — delete action", () => {
    it("deletes an order", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "delete", orderId: "CLM-1" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDeleteOrderCompletely).toHaveBeenCalled();
    });
  });

  describe("PUT — unsupported action", () => {
    it("returns 400", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/orders",
        body: { action: "fly" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });
});
