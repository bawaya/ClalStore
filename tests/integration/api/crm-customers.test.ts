/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeCustomer,
  makeCustomerNote,
  makeCustomerHotAccount,
  makeOrder,
  makeOrderItem,
  makePipelineDeal,
  makeBotConversation,
  makeAuditEntry,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const customer = makeCustomer({ id: "c1", phone: "0501234567", name: "Ahmad" });
const customer2 = makeCustomer({ id: "c2", phone: "0509876543", name: "Sara" });
const note = makeCustomerNote({ id: "n1", customer_id: "c1" });
const hotAccount = makeCustomerHotAccount({ id: "ha1", customer_id: "c1", hot_mobile_id: "HOT123" });
const order = makeOrder({ id: "CLM-1", customer_id: "c1", total: 3499 });
const orderItem = makeOrderItem({ order_id: "CLM-1" });

// ── Hoisted mocks ────────────────────────────────────
const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: "u1",
    email: "admin@test.com",
    role: "super_admin",
    name: "Admin",
    appUserId: "u1",
  },
}));

// ── Mocks ─────────────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  customers: { data: [customer, customer2] },
  customer_notes: { data: [note] },
  customer_hot_accounts: { data: [hotAccount] },
  orders: { data: [{ ...order, order_items: [orderItem] }] },
  pipeline_deals: { data: [makePipelineDeal({ customer_id: "c1" })] },
  bot_conversations: { data: [makeBotConversation({ customer_id: "c1" })] },
  audit_log: { data: [makeAuditEntry({ entity_id: "c1" })] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/admin/auth", () => ({
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
}));

vi.mock("@/lib/crm/customer-timeline", () => ({
  buildCustomerTimeline: vi.fn().mockReturnValue([]),
}));

// ── Imports (after mocks) ─────────────────────────────
import { GET as listCustomers, POST as createCustomer } from "@/app/api/crm/customers/route";
import { GET as getCustomer, PUT as updateCustomer, DELETE as deleteCustomer } from "@/app/api/crm/customers/[id]/route";
import { GET as getNotes, POST as createNote } from "@/app/api/crm/customers/[id]/notes/route";
import { GET as getHotAccounts, POST as createHotAccount, PUT as updateHotAccount, DELETE as deleteHotAccount } from "@/app/api/crm/customers/[id]/hot-accounts/route";
import { GET as get360 } from "@/app/api/crm/customers/[id]/360/route";
import { GET as exportCustomers } from "@/app/api/crm/customers/export/route";
import { POST as reconcile } from "@/app/api/crm/customers/reconcile/route";

// ── Tests ─────────────────────────────────────────────

describe("CRM Customers — /api/crm/customers", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── GET /api/crm/customers ────────────────────────
  describe("GET (list)", () => {
    it("returns customer list with total", async () => {
      const req = createMockRequest({ url: "/api/crm/customers" });
      const res = await listCustomers(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.customers).toBeDefined();
    });

    it("returns orders when customerId param is provided", async () => {
      const req = createMockRequest({
        url: "/api/crm/customers",
        searchParams: { customerId: "c1" },
      });
      const res = await listCustomers(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.orders).toBeDefined();
    });

    it("filters by segment", async () => {
      const req = createMockRequest({
        url: "/api/crm/customers",
        searchParams: { segment: "active" },
      });
      const res = await listCustomers(req);
      expect(res.status).toBe(200);
    });

    it("filters by search term", async () => {
      const req = createMockRequest({
        url: "/api/crm/customers",
        searchParams: { search: "Ahmad" },
      });
      const res = await listCustomers(req);
      expect(res.status).toBe(200);
    });

    it("filters by hot_search", async () => {
      const req = createMockRequest({
        url: "/api/crm/customers",
        searchParams: { hot_search: "HOT123" },
      });
      const res = await listCustomers(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── POST /api/crm/customers ────────────────────────
  describe("POST (create)", () => {
    it("creates a new customer", async () => {
      // maybeSingle returns null → no duplicate
      supabaseClient.from("customers").maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers",
        body: { name: "New Customer", phone: "0501112233" },
      });
      const res = await createCustomer(req);
      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
    });

    it("returns 409 for duplicate phone", async () => {
      supabaseClient.from("customers").maybeSingle.mockResolvedValueOnce({ data: { id: "existing" }, error: null });
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers",
        body: { name: "Dup", phone: "0501234567" },
      });
      const res = await createCustomer(req);
      expect(res.status).toBe(409);
    });
  });
});

describe("CRM Customer [id] — /api/crm/customers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── GET /api/crm/customers/:id ─────────────────────
  describe("GET", () => {
    it("returns a single customer", async () => {
      const req = createMockRequest({ url: "/api/crm/customers/c1" });
      const res = await getCustomer(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 404 when customer not found", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
      const req = createMockRequest({ url: "/api/crm/customers/missing" });
      const res = await getCustomer(req);
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/crm/customers/:id ─────────────────────
  describe("PUT", () => {
    it("updates customer data", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/customers/c1",
        body: { name: "Updated Name" },
      });
      const res = await updateCustomer(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  // ─── DELETE /api/crm/customers/:id ──────────────────
  describe("DELETE", () => {
    it("deletes a customer", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: { id: "c1", name: "Ahmad" }, error: null });
      const req = createMockRequest({ method: "DELETE", url: "/api/crm/customers/c1" });
      const res = await deleteCustomer(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 404 for missing customer", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: null, error: null });
      const req = createMockRequest({ method: "DELETE", url: "/api/crm/customers/missing" });
      const res = await deleteCustomer(req);
      expect(res.status).toBe(404);
    });
  });
});

describe("Customer Notes — /api/crm/customers/[id]/notes", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns notes for a customer", async () => {
      const req = createMockRequest({ url: "/api/crm/customers/c1/notes" });
      const res = await getNotes(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.notes).toBeDefined();
    });
  });

  describe("POST", () => {
    it("creates a note", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers/c1/notes",
        body: { text: "Follow up needed" },
      });
      const res = await createNote(req);
      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
    });
  });
});

describe("Customer Hot Accounts — /api/crm/customers/[id]/hot-accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns hot accounts for a customer", async () => {
      const req = createMockRequest({ url: "/api/crm/customers/c1/hot-accounts" });
      const res = await getHotAccounts(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.hotAccounts).toBeDefined();
    });
  });

  describe("POST", () => {
    it("creates a hot account link", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: { id: "c1" }, error: null });
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers/c1/hot-accounts",
        body: { hot_mobile_id: "HOT999", status: "pending" },
      });
      const res = await createHotAccount(req);
      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
    });

    it("returns 404 for non-existent customer", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: null, error: null });
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers/missing/hot-accounts",
        body: { hot_mobile_id: "HOT999" },
      });
      const res = await createHotAccount(req);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT", () => {
    it("updates a hot account", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/customers/c1/hot-accounts",
        searchParams: { accountId: "ha1" },
        body: { label: "Updated Label" },
      });
      const res = await updateHotAccount(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when accountId is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/customers/c1/hot-accounts",
        body: { label: "Test" },
      });
      const res = await updateHotAccount(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("archives a hot account", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/customers/c1/hot-accounts",
        searchParams: { accountId: "ha1" },
      });
      const res = await deleteHotAccount(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 400 when accountId is missing", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/customers/c1/hot-accounts",
      });
      const res = await deleteHotAccount(req);
      expect(res.status).toBe(400);
    });
  });
});

describe("Customer 360 — /api/crm/customers/[id]/360", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns full 360 view", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: customer, error: null });
      const req = createMockRequest({ url: "/api/crm/customers/c1/360" });
      const res = await get360(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.customer).toBeDefined();
      expect(body.orders).toBeDefined();
      expect(body.timeline).toBeDefined();
    });

    it("returns 404 for non-existent customer", async () => {
      supabaseClient.from("customers").single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
      const req = createMockRequest({ url: "/api/crm/customers/missing/360" });
      const res = await get360(req);
      expect(res.status).toBe(404);
    });
  });
});

describe("Customer Export — /api/crm/customers/export", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns CSV data", async () => {
      const req = createMockRequest({ url: "/api/crm/customers/export" });
      const res = await exportCustomers(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      const text = await res.text();
      expect(text).toContain("الاسم"); // Arabic header row
    });

    it("filters by segment param", async () => {
      const req = createMockRequest({
        url: "/api/crm/customers/export",
        searchParams: { segment: "vip" },
      });
      const res = await exportCustomers(req);
      expect(res.status).toBe(200);
    });
  });
});

describe("Customer Reconcile — /api/crm/customers/reconcile", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("POST", () => {
    it("reconciles stats for all customers", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers/reconcile",
        body: {},
      });
      const res = await reconcile(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.updated).toBeDefined();
    });

    it("reconciles stats for a specific customer", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/customers/reconcile",
        body: { customer_id: "c1" },
      });
      const res = await reconcile(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.updated).toBeDefined();
    });
  });
});
