/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
  makeSalesDocItem,
  makeSalesDocEvent,
  makeCustomer,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const doc = makeSalesDoc({ id: 1, employee_key: "emp1", employee_user_id: "emp1", status: "draft", sale_type: "device" });
const docItem = makeSalesDocItem({ sales_doc_id: 1 });
const event = makeSalesDocEvent({ sales_doc_id: 1 });
const customer = makeCustomer({ id: "cust1", phone: "0501234567", customer_code: "CLAL-001" });

// ── Supabase mock ─────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  sales_docs: { data: [doc] },
  sales_doc_items: { data: [docItem] },
  sales_doc_events: { data: [event] },
  customers: { data: [customer] },
  orders: { data: [] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn().mockResolvedValue({
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
  }),
}));

vi.mock("@/lib/pwa/customer-linking", () => ({
  extractCustomerIdsFromSalesDocs: vi.fn().mockReturnValue([]),
  attachCustomersToSalesDocs: vi.fn().mockImplementation((docs: any[]) => docs),
  buildCustomerPhoneCandidates: vi.fn().mockImplementation((phone: string) => [phone]),
}));

vi.mock("@/lib/pwa/validators", () => ({
  createSalesDocSchema: { _input: undefined, _output: undefined },
  updateSalesDocSchema: { _input: undefined, _output: undefined },
}));

vi.mock("@/lib/admin/validators", () => ({
  validateBody: vi.fn().mockImplementation((body: any) => ({
    data: body,
    error: null,
  })),
}));

// Submit route calls registerSaleCommission directly (no manager approval,
// decision 1). Mocked so tests focus on route logic (auth / status
// transition) without stubbing every commission_sales insert.
vi.mock("@/lib/commissions/register", () => ({
  registerSaleCommission: vi.fn().mockResolvedValue({
    id: 100,
    contractCommission: 175,
    employeeCommission: 175,
    rateSnapshot: {
      line_multiplier: 4,
      device_rate: 0.05,
      device_milestone_bonus: 2500,
      min_package_price: 19.9,
      loyalty_bonuses: {},
    },
  }),
}));

// ── Imports ───────────────────────────────────────────
import { GET as listSales, POST as createSale } from "@/app/api/pwa/sales/route";
import { GET as getSale, PUT as updateSale } from "@/app/api/pwa/sales/[id]/route";
import { POST as submitSale } from "@/app/api/pwa/sales/[id]/submit/route";
import { GET as customerLookup } from "@/app/api/pwa/customer-lookup/route";

// Helper for parameterised routes
const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

// ── Tests ─────────────────────────────────────────────

describe("PWA Sales — GET /api/pwa/sales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns sales docs for authenticated employee", async () => {
    const req = createMockRequest({ url: "/api/pwa/sales" });
    const res = await listSales(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.docs).toBeDefined();
  });

  it("filters by status", async () => {
    const req = createMockRequest({
      url: "/api/pwa/sales",
      searchParams: { status: "draft" },
    });
    const res = await listSales(req);
    expect(res.status).toBe(200);
  });

  it("filters by date range", async () => {
    const req = createMockRequest({
      url: "/api/pwa/sales",
      searchParams: { date_from: "2026-04-01", date_to: "2026-04-17" },
    });
    const res = await listSales(req);
    expect(res.status).toBe(200);
  });
});

describe("PWA Sales — POST /api/pwa/sales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new sales doc", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: { sale_type: "device", total_amount: 3499, items: [] },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
});

describe("PWA Sales [id] — GET /api/pwa/sales/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns sales doc with items and events", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({ data: doc, error: null });
    const req = createMockRequest({ url: "/api/pwa/sales/1" });
    const res = await getSale(req, ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.doc).toBeDefined();
    expect(body.items).toBeDefined();
    expect(body.events).toBeDefined();
  });

  it("returns 404 for missing doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    const req = createMockRequest({ url: "/api/pwa/sales/999" });
    const res = await getSale(req, ctxOf("999"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid id", async () => {
    const req = createMockRequest({ url: "/api/pwa/sales/abc" });
    const res = await getSale(req, ctxOf("abc"));
    expect(res.status).toBe(400);
  });
});

describe("PWA Sales [id] — PUT /api/pwa/sales/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a draft sales doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 1, employee_key: "emp1", status: "draft" },
      error: null,
    });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/pwa/sales/1",
      body: { total_amount: 3999 },
    });
    const res = await updateSale(req, ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 403 for wrong employee", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 1, employee_key: "other-emp", status: "draft" },
      error: null,
    });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/pwa/sales/1",
      body: { total_amount: 3999 },
    });
    const res = await updateSale(req, ctxOf("1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-editable status", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 1, employee_key: "emp1", status: "verified" },
      error: null,
    });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/pwa/sales/1",
      body: { total_amount: 3999 },
    });
    const res = await updateSale(req, ctxOf("1"));
    expect(res.status).toBe(400);
  });
});

describe("PWA Sales Submit — POST /api/pwa/sales/[id]/submit", () => {
  beforeEach(() => vi.clearAllMocks());

  // 2026-04-18: attachments system removed — submit is data-only.
  // Route uses .maybeSingle() for the initial doc lookup (idempotent).
  it("submits a draft with no attachments required", async () => {
    const submittingDoc = { ...doc, sale_type: "device", total_amount: 3499 };
    supabaseClient.from("sales_docs").maybeSingle.mockResolvedValueOnce({
      data: submittingDoc,
      error: null,
    });
    supabaseClient.from("sales_docs").maybeSingle.mockResolvedValueOnce({
      data: { ...submittingDoc, status: "synced_to_commissions" },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 400 when total_amount is 0", async () => {
    supabaseClient.from("sales_docs").maybeSingle.mockResolvedValueOnce({
      data: { ...doc, sale_type: "line", total_amount: 0 },
      error: null,
    });
    const req = createMockRequest({ method: "POST", url: "/api/pwa/sales/1/submit" });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing doc", async () => {
    supabaseClient.from("sales_docs").maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({ method: "POST", url: "/api/pwa/sales/999/submit" });
    const res = await submitSale(req, ctxOf("999"));
    expect(res.status).toBe(404);
  });
});

// PWA Attachments describe removed 2026-04-18: attachments endpoints deleted.

describe("PWA Customer Lookup — GET /api/pwa/customer-lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up customer by phone", async () => {
    supabaseClient.from("customers").maybeSingle.mockResolvedValueOnce({
      data: customer,
      error: null,
    });
    const req = createMockRequest({
      url: "/api/pwa/customer-lookup",
      searchParams: { phone: "0501234567" },
    });
    const res = await customerLookup(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("looks up customer by code", async () => {
    supabaseClient.from("customers").maybeSingle.mockResolvedValueOnce({
      data: customer,
      error: null,
    });
    const req = createMockRequest({
      url: "/api/pwa/customer-lookup",
      searchParams: { code: "CLAL-001" },
    });
    const res = await customerLookup(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 400 without phone or code", async () => {
    const req = createMockRequest({ url: "/api/pwa/customer-lookup" });
    const res = await customerLookup(req);
    expect(res.status).toBe(400);
  });

  it("returns null data when customer not found", async () => {
    supabaseClient.from("customers").maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      url: "/api/pwa/customer-lookup",
      searchParams: { phone: "0500000000" },
    });
    const res = await customerLookup(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
  });
});
