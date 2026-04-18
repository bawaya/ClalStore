/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for Employee PWA endpoints — spec 3E.
 *
 * Fills gaps beyond `tests/integration/api/employee-pwa.test.ts` (which
 * already covers dashboard basics, calculate, chart, corrections create,
 * announcements list). This file adds:
 *   - GET /api/employee/commissions/details
 *   - GET /api/employee/commissions/export (PDF)
 *   - GET /api/employee/activity
 *   - Extra dashboard assertions (dailyRequired, target progress %)
 *   - Employee-only isolation for corrections GET
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
} from "@/tests/helpers";

// ── Hoisted mocks ──────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  employeeAuth: {
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
    email: "emp1@clal.test",
  },
  clientRef: { current: null as any },
  authResponse: null as any,
}));

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn(() =>
    Promise.resolve(hoisted.authResponse ?? hoisted.employeeAuth),
  ),
}));

function makeClient(tables: Record<string, { data?: any; error?: any }> = {}) {
  return createMockSupabaseClient(tables);
}

// Minimal sale row — only fields the route reads. Override with partials.
function saleRow(o: Partial<Record<string, any>> = {}) {
  return {
    id: 1,
    sale_date: "2026-04-10",
    sale_type: "line",
    customer_name: null,
    customer_phone: null,
    device_name: null,
    package_price: null,
    device_sale_amount: null,
    commission_amount: 0,
    contract_commission: 0,
    source: "manual",
    source_sales_doc_id: null,
    source_pipeline_deal_id: null,
    rate_snapshot: null,
    loyalty_start_date: null,
    loyalty_status: null,
    ...o,
  };
}

// Route imports (after mocks)
import { GET as getDetails } from "@/app/api/employee/commissions/details/route";
import { GET as getExport } from "@/app/api/employee/commissions/export/route";
import { GET as getDashboard } from "@/app/api/employee/commissions/dashboard/route";
import {
  GET as listCorrections,
  POST as submitCorrection,
} from "@/app/api/employee/corrections/route";
import { GET as getActivity } from "@/app/api/employee/activity/route";

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.authResponse = null;
});

// ════════════════════════════════════════════════════════
// GET /api/employee/commissions/details
// ════════════════════════════════════════════════════════
describe("GET /api/employee/commissions/details", () => {
  it("returns all sales for the given month with calculation breakdown", async () => {
    hoisted.clientRef.current = makeClient({
      commission_sales: {
        data: [
          saleRow({ id: 1, sale_type: "line", package_price: 39.9, commission_amount: 159.6, contract_commission: 159.6, customer_name: "Ahmad", customer_phone: "0501234567", source: "auto_sync" }),
          saleRow({ id: 2, sale_date: "2026-04-12", sale_type: "device", device_sale_amount: 4000, commission_amount: 200, contract_commission: 200, customer_name: "Noor", device_name: "iPhone 15", source_sales_doc_id: 42 }),
        ],
      },
      commission_sanctions: { data: [] },
    });
    const req = createMockRequest({
      url: "/api/employee/commissions/details?month=2026-04",
    });
    const res = await getDetails(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.month).toBe("2026-04");
    expect(Array.isArray(body.data.sales)).toBe(true);
    expect(body.data.sales).toHaveLength(2);
    for (const s of body.data.sales) {
      expect(s.commission).toBeDefined();
      expect(s.commission.calculation).toMatch(/\(contract\)|\(employee\)/);
      expect(typeof s.commission.contractAmount).toBe("number");
      expect(typeof s.commission.employeeAmount).toBe("number");
      expect(typeof s.commission.ownerProfit).toBe("number");
      expect(s.status).toBe("active");
    }
  });

  it("returns milestones list for the month", async () => {
    // 2 device sales, 50K + 30K → 1 milestone at 50K band
    hoisted.clientRef.current = makeClient({
      commission_sales: {
        data: [
          saleRow({ id: 10, sale_date: "2026-04-05", sale_type: "device", device_sale_amount: 50000, commission_amount: 2500, contract_commission: 2500 }),
          saleRow({ id: 11, sale_date: "2026-04-12", sale_type: "device", device_sale_amount: 30000, commission_amount: 1500, contract_commission: 1500 }),
        ],
      },
      commission_sanctions: { data: [] },
    });
    const req = createMockRequest({
      url: "/api/employee/commissions/details?month=2026-04",
    });
    const res = await getDetails(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data.milestones)).toBe(true);
    expect(body.data.milestones.length).toBeGreaterThanOrEqual(1);
  });

  it("returns sanctions alongside sales", async () => {
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: {
        data: [
          {
            id: 5,
            sanction_date: "2026-04-05",
            sanction_type: "deduction",
            amount: 100,
            description: "test",
            has_sale_offset: false,
          },
        ],
      },
    });
    const req = createMockRequest({
      url: "/api/employee/commissions/details?month=2026-04",
    });
    const res = await getDetails(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.sanctions).toHaveLength(1);
    expect(body.data.sanctions[0].amount).toBe(100);
  });

  it("falls back to current IL month when ?month param is missing/invalid", async () => {
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
    });
    const req = createMockRequest({
      url: "/api/employee/commissions/details?month=not-a-month",
    });
    const res = await getDetails(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("empty month returns empty sales and zero milestones", async () => {
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
    });
    const req = createMockRequest({
      url: "/api/employee/commissions/details?month=2026-04",
    });
    const res = await getDetails(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.sales).toHaveLength(0);
    expect(body.data.milestones).toHaveLength(0);
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient();
    const req = createMockRequest({ url: "/api/employee/commissions/details" });
    const res = await getDetails(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// GET /api/employee/commissions/export (PDF)
// ════════════════════════════════════════════════════════
describe("GET /api/employee/commissions/export (PDF)", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
    });
  });

  it("returns Content-Type: application/pdf", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("PDF body starts with %PDF- magic bytes", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const head = String.fromCharCode(...bytes.slice(0, 5));
    expect(head).toBe("%PDF-");
  });

  it("Content-Disposition includes filename 'commission-<month>.pdf'", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    const disposition = res.headers.get("content-disposition") || "";
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/filename="commission-2026-04\.pdf"/);
  });

  it("Cache-Control is private, no-store", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("Cairo font path does not crash the route — falls back to Helvetica on error", async () => {
    // The route tries to load public/fonts/cairo-regular.ttf and embed it.
    // If pdf-lib fails to parse the bytes (e.g. during Vitest's Node bundle
    // where Buffer.from(Uint8Array) has historically been flaky), the route
    // catches the error and falls back to Helvetica. Either path → 200.
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("produces a PDF even when there are sales + sanctions + milestones", async () => {
    hoisted.clientRef.current = makeClient({
      commission_sales: {
        data: [
          saleRow({ sale_type: "device", device_sale_amount: 50000, commission_amount: 2500, contract_commission: 2500, customer_name: "علي" }),
          saleRow({ sale_date: "2026-04-11", sale_type: "line", package_price: 50, commission_amount: 200, contract_commission: 200, customer_name: "Noor", source: "auto_sync" }),
        ],
      },
      commission_sanctions: {
        data: [
          { sanction_date: "2026-04-05", sanction_type: "deduction", amount: 100, description: "late form" },
        ],
      },
    });
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient();
    const req = createMockRequest({
      url: "/api/employee/commissions/export?month=2026-04",
    });
    const res = await getExport(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// GET /api/employee/commissions/dashboard — extra assertions
// ════════════════════════════════════════════════════════
describe("GET /api/employee/commissions/dashboard — extra coverage", () => {
  it("target=10000 with no sales → targetProgress=0 and remainingAmount=10000", async () => {
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const monthStr = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
      commission_targets: {
        data: [{ user_id: "emp1", month: monthStr, target_total: 10000 }],
      },
    });
    const req = createMockRequest({ url: "/api/employee/commissions/dashboard" });
    const res = await getDashboard(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.month.target).toBe(10000);
    expect(body.data.month.targetProgress).toBe(0);
    expect(body.data.month.remainingAmount).toBe(10000);
  });

  it("exposes dailyRequired and workingDaysLeft", async () => {
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const monthStr = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
      commission_targets: {
        data: [{ user_id: "emp1", month: monthStr, target_total: 10000 }],
      },
    });
    const req = createMockRequest({ url: "/api/employee/commissions/dashboard" });
    const res = await getDashboard(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.data.month.workingDaysLeft).toBe("number");
    expect(typeof body.data.month.dailyRequired).toBe("number");
    // If there are working days left, dailyRequired > 0 for non-zero remaining
    if (body.data.month.workingDaysLeft > 0) {
      expect(body.data.month.dailyRequired).toBeGreaterThan(0);
    }
  });

  it("milestonesReached starts at 0 for a fresh month", async () => {
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
      commission_targets: { data: [] },
    });
    const req = createMockRequest({ url: "/api/employee/commissions/dashboard" });
    const res = await getDashboard(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.milestones.milestonesReached).toBe(0);
    expect(body.data.milestones.currentTotal).toBe(0);
    expect(body.data.milestones.bonusEarned).toBe(0);
  });

  it("milestones bonus reflects devices crossing the threshold", async () => {
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const monthStr = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    hoisted.clientRef.current = makeClient({
      commission_sales: {
        data: [
          saleRow({ sale_type: "device", sale_date: `${monthStr}-10`, device_sale_amount: 50000, commission_amount: 2500 }),
        ],
      },
      commission_sanctions: { data: [] },
      commission_targets: { data: [] },
    });
    const req = createMockRequest({ url: "/api/employee/commissions/dashboard" });
    const res = await getDashboard(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.milestones.currentTotal).toBe(50000);
    expect(body.data.milestones.milestonesReached).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════
// GET /api/employee/corrections — returns only the authed employee's rows
// ════════════════════════════════════════════════════════
describe("GET /api/employee/corrections — ownership", () => {
  it("returns rows and the DB query is filtered by employee_id", async () => {
    const client = makeClient({
      commission_correction_requests: {
        data: [
          { id: 1, employee_id: "emp1", request_type: "amount_error", description: "My commission looks low", status: "pending", commission_sale_id: 99, sales_doc_id: null, created_at: "2026-04-10T00:00:00Z" },
        ],
      },
    });
    hoisted.clientRef.current = client;
    const req = createMockRequest({ url: "/api/employee/corrections" });
    const res = await listCorrections(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.requests)).toBe(true);
    // The filter .eq('employee_id', 'emp1') was called
    const builder = client.__queryBuilders.get("commission_correction_requests")!;
    const calls = builder.eq.mock.calls;
    const employeeIdFilter = calls.find(
      (c: any[]) => c[0] === "employee_id" && c[1] === "emp1",
    );
    expect(employeeIdFilter).toBeDefined();
  });

  it("POST defaults status to 'pending' (sent to DB insert)", async () => {
    const client = makeClient({
      commission_correction_requests: { data: [] },
      employee_activity_log: { data: [] },
    });
    client.__queryBuilders.get("commission_correction_requests")!.single = vi
      .fn()
      .mockResolvedValue({
        data: { id: 77, employee_id: "emp1", request_type: "other", status: "pending" },
        error: null,
      });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/corrections",
      body: {
        requestType: "other",
        description: "This is a long enough description",
      },
    });
    const res = await submitCorrection(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    const insertMock = client.__queryBuilders.get("commission_correction_requests")!.insert;
    const payload = insertMock.mock.calls[0]?.[0];
    expect(payload?.status).toBe("pending");
    expect(payload?.employee_id).toBe("emp1");
    expect(body.data.request.status).toBe("pending");
  });

  it("POST rejects requestType missing (400)", async () => {
    hoisted.clientRef.current = makeClient({
      commission_correction_requests: { data: [] },
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/corrections",
      body: { description: "sufficient description" },
    });
    const res = await submitCorrection(req);
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════
// GET /api/employee/activity
// ════════════════════════════════════════════════════════
describe("GET /api/employee/activity", () => {
  function installActivities(rows: any[], count = rows.length) {
    const client = makeClient({ employee_activity_log: { data: rows } });
    const builder = client.__queryBuilders.get("employee_activity_log")!;
    // range() returns the paginated response shape { data, error, count }
    builder.range = vi
      .fn()
      .mockResolvedValue({ data: rows, error: null, count });
    hoisted.clientRef.current = client;
    return client;
  }

  it("returns paginated rows with total count (default limit=50, offset=0)", async () => {
    installActivities([{ id: 1, event_type: "sale_registered", title: "Sale", created_at: "2026-04-10T00:00:00Z" }], 1);
    const req = createMockRequest({ url: "/api/employee/activity" });
    const res = await getActivity(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activities).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.limit).toBe(50);
    expect(body.data.offset).toBe(0);
    expect(body.data.hasMore).toBe(false);
  });

  it("hasMore=true when total > offset + returned rows", async () => {
    installActivities(
      [{ id: 1, event_type: "sale_registered", title: "s" }],
      100,
    );
    const req = createMockRequest({
      url: "/api/employee/activity",
      searchParams: { limit: "1", offset: "0" },
    });
    const res = await getActivity(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.hasMore).toBe(true);
    expect(body.data.limit).toBe(1);
  });

  it("enforces max limit of 100", async () => {
    installActivities([], 0);
    const req = createMockRequest({
      url: "/api/employee/activity",
      searchParams: { limit: "500" },
    });
    const res = await getActivity(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.limit).toBe(100);
  });

  it("filters by authed employee id (order + eq called with appUserId)", async () => {
    const client = installActivities([], 0);
    const req = createMockRequest({ url: "/api/employee/activity" });
    await getActivity(req);
    const builder = client.__queryBuilders.get("employee_activity_log")!;
    const eqCalls = builder.eq.mock.calls;
    const empIdFilter = eqCalls.find(
      (c: any[]) => c[0] === "employee_id" && c[1] === "emp1",
    );
    expect(empIdFilter).toBeDefined();
    // Ordered desc by created_at
    expect(builder.order).toHaveBeenCalledWith(
      "created_at",
      expect.objectContaining({ ascending: false }),
    );
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient();
    const req = createMockRequest({ url: "/api/employee/activity" });
    const res = await getActivity(req);
    expect(res.status).toBe(401);
  });
});
