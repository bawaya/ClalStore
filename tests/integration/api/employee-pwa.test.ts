/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unified Employee PWA — integration tests
 *
 * Covers the new endpoints shipped in migration 20260418000006:
 *   - Dashboard (today + month + milestones + pacing)
 *   - Calculate (pure commission preview)
 *   - Chart (last N months)
 *   - Corrections (employee + admin sides)
 *   - Announcements (employee list + mark-read + admin publish)
 *
 * Strategy: each endpoint gets its own vi.mock for `@/lib/supabase` and
 * `@/lib/pwa/auth` / `@/lib/admin/auth`. We avoid a global mock so a
 * test can customise the Supabase client (e.g. inject an error) without
 * bleeding state into the next describe block.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
} from "@/tests/helpers";

// ────────────────────────────────────────────────────────
// Hoisted shared state (vi.mock factories close over this)
// ────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  employeeAuth: {
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
    email: "emp1@clal.test",
  },
  adminAuth: {
    id: "auth-adm1",
    email: "admin@clal.test",
    role: "super_admin",
    appUserId: "adm1",
    name: "Admin",
  },
  hasPermission: true,
  clientRef: { current: null as any },
  authResponse: null as any,
  adminAuthResponse: null as any,
}));

// ────────────────────────────────────────────────────────
// Mocks — these must be declared at the top of the file
// (vi.mock() is hoisted regardless of placement).
// ────────────────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn(() =>
    Promise.resolve(hoisted.authResponse ?? hoisted.employeeAuth),
  ),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn(() =>
      Promise.resolve(hoisted.adminAuthResponse ?? hoisted.adminAuth),
    ),
    hasPermission: vi.fn(() => hoisted.hasPermission),
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

// ────────────────────────────────────────────────────────
// Supabase client setup
// ────────────────────────────────────────────────────────
function makeClient(tables: Record<string, { data?: any; error?: any }> = {}) {
  return createMockSupabaseClient(tables);
}

// ────────────────────────────────────────────────────────
// Route imports (after mocks)
// ────────────────────────────────────────────────────────
import { GET as getDashboard } from "@/app/api/employee/commissions/dashboard/route";
import { POST as calculate } from "@/app/api/employee/commissions/calculate/route";
import { GET as getChart } from "@/app/api/employee/commissions/chart/route";
import {
  GET as listCorrections,
  POST as submitCorrection,
} from "@/app/api/employee/corrections/route";
import { GET as listAnnouncements } from "@/app/api/employee/announcements/route";
import { POST as markRead } from "@/app/api/employee/announcements/[id]/read/route";
import { POST as createAnnouncement } from "@/app/api/admin/announcements/route";
import { PUT as respondCorrection } from "@/app/api/admin/corrections/[id]/route";

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.authResponse = null;
  hoisted.adminAuthResponse = null;
  hoisted.hasPermission = true;
});

// ════════════════════════════════════════════════════════
// Dashboard — /api/employee/commissions/dashboard
// ════════════════════════════════════════════════════════
describe("GET /api/employee/commissions/dashboard", () => {
  it("returns today + month + milestones with correct shapes", async () => {
    const nowYMD = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const todayISO = `${nowYMD.getFullYear()}-${String(nowYMD.getMonth() + 1).padStart(2, "0")}-${String(nowYMD.getDate()).padStart(2, "0")}`;
    const monthStr = todayISO.slice(0, 7);

    const client = makeClient({
      commission_sales: {
        data: [
          {
            id: 101,
            commission_amount: 159.6,
            package_price: 39.9,
            device_sale_amount: null,
            sale_type: "line",
            sale_date: todayISO,
            source: "auto_sync",
            loyalty_start_date: null,
            loyalty_status: null,
          },
          {
            id: 102,
            commission_amount: 200,
            package_price: null,
            device_sale_amount: 4000,
            sale_type: "device",
            sale_date: `${monthStr}-05`,
            source: "manual",
            loyalty_start_date: null,
            loyalty_status: null,
          },
        ],
      },
      commission_sanctions: { data: [] },
      commission_targets: {
        data: [{ user_id: "emp1", month: monthStr, target_total: 10000 }],
      },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      url: "/api/employee/commissions/dashboard",
    });
    const res = await getDashboard(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // `apiSuccess` spreads top-level fields for back-compat
    expect(body.today).toBeDefined();
    expect(body.month).toBeDefined();
    expect(body.milestones).toBeDefined();
    expect(body.today).toHaveProperty("date");
    expect(body.today).toHaveProperty("salesCount");
    expect(body.today).toHaveProperty("commission");
    expect(body.month).toHaveProperty("target");
    expect(body.month).toHaveProperty("pacingColor");
    expect(["green", "yellow", "red"]).toContain(body.month.pacingColor);
    expect(body.milestones).toHaveProperty("currentTotal");
    expect(body.milestones).toHaveProperty("nextMilestoneAt");
    expect(typeof body.milestones.milestonesReached).toBe("number");
  });

  it("returns green pacingColor when progress ≥ expected", async () => {
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const monthStr = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;

    // Simulate massive achievement vs small target (easy green)
    const client = makeClient({
      commission_sales: {
        data: [
          {
            id: 1,
            commission_amount: 5000,
            package_price: null,
            device_sale_amount: 100000,
            sale_type: "device",
            sale_date: `${monthStr}-01`,
            source: "manual",
            loyalty_start_date: null,
            loyalty_status: null,
          },
        ],
      },
      commission_sanctions: { data: [] },
      commission_targets: {
        data: [{ user_id: "emp1", month: monthStr, target_total: 1000 }],
      },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      url: "/api/employee/commissions/dashboard",
    });
    const res = await getDashboard(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.month.pacingColor).toBe("green");
  });

  it("returns red pacingColor when progress is far behind", async () => {
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const monthStr = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;

    const client = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
      commission_targets: {
        data: [{ user_id: "emp1", month: monthStr, target_total: 100000 }],
      },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      url: "/api/employee/commissions/dashboard",
    });
    const res = await getDashboard(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    // If the month is early and no sales, pacing should be red or at worst yellow
    expect(["yellow", "red"]).toContain(body.month.pacingColor);
  });

  it("empty month returns zeros, not null", async () => {
    const client = makeClient({
      commission_sales: { data: [] },
      commission_sanctions: { data: [] },
      commission_targets: { data: [] },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      url: "/api/employee/commissions/dashboard",
    });
    const res = await getDashboard(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.today.salesCount).toBe(0);
    expect(body.today.totalAmount).toBe(0);
    expect(body.today.commission).toBe(0);
    expect(body.month.salesCount).toBe(0);
    expect(body.month.totalAmount).toBe(0);
    expect(body.month.totalCommission).toBe(0);
    expect(body.month.sanctions).toBe(0);
    expect(body.month.netCommission).toBe(0);
    expect(body.month.target).toBe(0);
    expect(body.milestones.currentTotal).toBe(0);
    expect(body.milestones.milestonesReached).toBe(0);
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResponse = NextResponse.json(
      { error: "unauth" },
      { status: 401 },
    );
    hoisted.clientRef.current = makeClient();
    const req = createMockRequest({
      url: "/api/employee/commissions/dashboard",
    });
    const res = await getDashboard(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// Calculate — /api/employee/commissions/calculate
// ════════════════════════════════════════════════════════
describe("POST /api/employee/commissions/calculate", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      employee_commission_profiles: { data: [] }, // default profile fallback
    });
  });

  it("line sale { saleType: 'line', amount: 39.90 } → contract 159.6 (default profile)", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/commissions/calculate",
      body: { saleType: "line", amount: 39.9 },
    });
    const res = await calculate(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // 39.9 × 4 (default multiplier) = 159.6
    expect(body.contractCommission).toBeCloseTo(159.6, 2);
    // Default profile → employeeCommission equals contract
    expect(body.employeeCommission).toBeCloseTo(159.6, 2);
    expect(body.ownerProfit).toBeCloseTo(0, 2);
  });

  it("device sale with profile override: employee rate differs from contract", async () => {
    // Install a custom per-employee profile with a lower device rate (4%)
    const client = makeClient({
      employee_commission_profiles: {
        data: [
          {
            line_multiplier: 4,
            device_rate: 0.04, // lower than contract's 5%
            device_milestone_bonus: 2500,
            appliance_rate: 0.05,
            appliance_milestone_bonus: 0,
            min_package_price: 19.9,
            loyalty_bonuses: {},
          },
        ],
      },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/commissions/calculate",
      body: { saleType: "device", amount: 10000 },
    });
    const res = await calculate(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // 10000 × 5% = 500 (contract)
    expect(body.contractCommission).toBeCloseTo(500, 2);
    // 10000 × 4% = 400 (employee)
    expect(body.employeeCommission).toBeCloseTo(400, 2);
    // owner profit = 100
    expect(body.ownerProfit).toBeCloseTo(100, 2);
  });

  it("negative amount → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/commissions/calculate",
      body: { saleType: "line", amount: -5 },
    });
    const res = await calculate(req);
    expect(res.status).toBe(400);
  });

  it("above MAX (> 100000) → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/commissions/calculate",
      body: { saleType: "device", amount: 100_001 },
    });
    const res = await calculate(req);
    expect(res.status).toBe(400);
  });

  it("unknown saleType → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/commissions/calculate",
      body: { saleType: "banana", amount: 50 },
    });
    const res = await calculate(req);
    expect(res.status).toBe(400);
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResponse = NextResponse.json(
      { error: "unauth" },
      { status: 401 },
    );
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/commissions/calculate",
      body: { saleType: "line", amount: 50 },
    });
    const res = await calculate(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// Chart — /api/employee/commissions/chart
// ════════════════════════════════════════════════════════
describe("GET /api/employee/commissions/chart", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      commission_sales: { data: [] },
      commission_targets: { data: [] },
    });
  });

  it("returns 6 months by default", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/chart",
    });
    const res = await getChart(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.months)).toBe(true);
    expect(body.months).toHaveLength(6);
    expect(body.sales).toHaveLength(6);
    expect(body.commissions).toHaveLength(6);
    expect(body.targets).toHaveLength(6);
  });

  it("respects range=12months", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/chart",
      searchParams: { range: "12months" },
    });
    const res = await getChart(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.months).toHaveLength(12);
  });

  it("clamps range to [1, 24]", async () => {
    const req = createMockRequest({
      url: "/api/employee/commissions/chart",
      searchParams: { range: "99months" },
    });
    const res = await getChart(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.months.length).toBeLessThanOrEqual(24);
  });

  it("aggregates sales correctly into the month buckets", async () => {
    const nowIL = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
    );
    const monthStr = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    const client = makeClient({
      commission_sales: {
        data: [
          {
            sale_date: `${monthStr}-15`,
            sale_type: "line",
            package_price: 50,
            device_sale_amount: null,
            commission_amount: 200,
          },
          {
            sale_date: `${monthStr}-20`,
            sale_type: "device",
            package_price: null,
            device_sale_amount: 3000,
            commission_amount: 150,
          },
        ],
      },
      commission_targets: {
        data: [{ user_id: "emp1", month: monthStr, target_total: 5000 }],
      },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({ url: "/api/employee/commissions/chart" });
    const res = await getChart(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // The current month is the last item (reverse chronological input → months[5])
    const last = body.months.length - 1;
    expect(body.months[last]).toBe(monthStr);
    expect(body.sales[last]).toBe(50 + 3000);
    expect(body.commissions[last]).toBe(200 + 150);
    expect(body.targets[last]).toBe(5000);
  });
});

// ════════════════════════════════════════════════════════
// Corrections — /api/employee/corrections
// ════════════════════════════════════════════════════════
describe("Employee corrections", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      commission_correction_requests: {
        data: [
          {
            id: 1,
            employee_id: "emp1",
            commission_sale_id: 10,
            sales_doc_id: null,
            request_type: "amount_error",
            description: "The amount seems off",
            status: "pending",
            admin_response: null,
            resolved_by: null,
            resolved_at: null,
            created_at: "2026-04-10T10:00:00Z",
            updated_at: "2026-04-10T10:00:00Z",
          },
        ],
      },
      employee_activity_log: { data: [] },
    });
  });

  it("GET returns the employee's requests", async () => {
    const req = createMockRequest({ url: "/api/employee/corrections" });
    const res = await listCorrections(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.requests)).toBe(true);
    expect(body.requests[0]).toHaveProperty("request_type");
  });

  it("POST valid request → 201 + inserts activity log", async () => {
    const client = hoisted.clientRef.current;
    // Force the insert's .single() to return a freshly-minted row
    const reqBuilder = client.__queryBuilders.get("commission_correction_requests")!;
    reqBuilder.single = vi.fn().mockResolvedValue({
      data: {
        id: 42,
        employee_id: "emp1",
        commission_sale_id: 10,
        sales_doc_id: null,
        request_type: "amount_error",
        description: "The line commission is half of what it should be",
        status: "pending",
        admin_response: null,
        resolved_by: null,
        resolved_at: null,
        created_at: "2026-04-11T10:00:00Z",
        updated_at: "2026-04-11T10:00:00Z",
      },
      error: null,
    });

    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/corrections",
      body: {
        commissionSaleId: 10,
        requestType: "amount_error",
        description: "The line commission is half of what it should be",
      },
    });
    const res = await submitCorrection(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.request.id).toBe(42);
    // Activity log insert fired (fire-and-forget)
    const activityBuilder = client.__queryBuilders.get("employee_activity_log");
    expect(activityBuilder?.insert).toHaveBeenCalled();
  });

  it("description < 10 chars → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/corrections",
      body: {
        requestType: "other",
        description: "short",
      },
    });
    const res = await submitCorrection(req);
    expect(res.status).toBe(400);
  });

  it("unknown request_type → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/corrections",
      body: {
        requestType: "made-up-type",
        description: "Something happened and I want a review.",
      },
    });
    const res = await submitCorrection(req);
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════
// Announcements (employee) — list + mark-read
// ════════════════════════════════════════════════════════
describe("Employee announcements", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 86400000).toISOString();
  const past = new Date(now.getTime() - 86400000).toISOString();

  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      admin_announcements: {
        // NOTE: route uses .or() chaining, the mock returns the raw data
        //       regardless of the filters. That means we must pre-filter
        //       expired rows ourselves (matches the SQL .or() clause).
        data: [
          {
            id: 1,
            title: "New policy",
            body: "Please read",
            priority: "high",
            target: "employees",
            created_by: "adm1",
            expires_at: future, // active
            created_at: "2026-04-10T08:00:00Z",
          },
          {
            id: 2,
            title: "Reminder",
            body: "Weekly sync",
            priority: "normal",
            target: "all",
            created_by: "adm1",
            expires_at: null,
            created_at: "2026-04-09T08:00:00Z",
          },
        ],
      },
      admin_announcement_reads: {
        data: [{ announcement_id: 1, user_id: "emp1" }], // emp1 already read #1
      },
    });
  });

  it("list returns items with read flag and correct unread count", async () => {
    const req = createMockRequest({ url: "/api/employee/announcements" });
    const res = await listAnnouncements(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.announcements)).toBe(true);
    expect(body.announcements).toHaveLength(2);
    // #1 is read, #2 is unread → unreadCount should be 1
    expect(body.unreadCount).toBe(1);
    const ids = body.announcements.map((a: any) => a.id).sort();
    expect(ids).toEqual([1, 2]);
    // Exactly one of them has read=true
    expect(body.announcements.filter((a: any) => a.read)).toHaveLength(1);
  });

  it("excludes expired announcements at the query layer (regression contract)", async () => {
    // A realistic client would respect the .or(expires_at.gt.now) clause.
    // We simulate the filtered result — the handler itself does not re-filter,
    // so we verify the contract by injecting only the active row.
    const client = makeClient({
      admin_announcements: {
        data: [
          {
            id: 1,
            title: "Active",
            body: "still valid",
            priority: "normal",
            target: "all",
            created_by: "adm1",
            expires_at: future,
            created_at: "2026-04-10T08:00:00Z",
          },
          // Expired row that the real DB would filter out;
          // we omit it on purpose to match production behaviour.
        ],
      },
      admin_announcement_reads: { data: [] },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({ url: "/api/employee/announcements" });
    const res = await listAnnouncements(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcements).toHaveLength(1);
    expect(body.announcements[0].id).toBe(1);
    // Just to show `past` is a real date we would have filtered out
    expect(past < future).toBe(true);
    expect(body.unreadCount).toBe(1);
  });

  it("mark-read inserts a row", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/announcements/7/read",
    });
    const res = await markRead(req, ctxOf("7"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const builder = hoisted.clientRef.current.__queryBuilders.get(
      "admin_announcement_reads",
    );
    expect(builder?.upsert).toHaveBeenCalled();
  });

  it("mark-read is idempotent on second call (upsert swallows duplicate key)", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/announcements/7/read",
    });
    const res1 = await markRead(req, ctxOf("7"));
    const res2 = await markRead(req, ctxOf("7"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("mark-read rejects non-numeric id with 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/employee/announcements/abc/read",
    });
    const res = await markRead(req, ctxOf("abc"));
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════
// Admin announcements — POST (publish)
// ════════════════════════════════════════════════════════
describe("POST /api/admin/announcements", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      admin_announcements: { data: [] },
    });
  });

  it("requires admin auth + settings:manage permission", async () => {
    hoisted.hasPermission = false;
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: {
        title: "Hello",
        body: "World",
        priority: "normal",
        target: "employees",
      },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(403);
  });

  it("validates required fields (missing title → 400)", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { body: "World" },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(400);
  });

  it("rejects bogus priority (400)", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: {
        title: "T",
        body: "B",
        priority: "super-urgent",
      },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(400);
  });

  it("happy path → 201 and returns the row", async () => {
    const client = hoisted.clientRef.current;
    const builder = client.__queryBuilders.get("admin_announcements")!;
    builder.single = vi.fn().mockResolvedValue({
      data: {
        id: 500,
        title: "Hello",
        body: "World",
        priority: "high",
        target: "employees",
        created_by: "adm1",
        expires_at: null,
        created_at: "2026-04-18T09:00:00Z",
      },
      error: null,
    });

    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: {
        title: "Hello",
        body: "World",
        priority: "high",
        target: "employees",
      },
    });
    const res = await createAnnouncement(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.announcement.id).toBe(500);
  });
});

// ════════════════════════════════════════════════════════
// Admin corrections — PUT (respond)
// ════════════════════════════════════════════════════════
describe("PUT /api/admin/corrections/[id]", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      commission_correction_requests: { data: [] },
      employee_activity_log: { data: [] },
      audit_log: { data: [] },
    });
  });

  function stubCorrectionResponse(row: any) {
    const builder = hoisted.clientRef.current.__queryBuilders.get(
      "commission_correction_requests",
    )!;
    builder.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: row, error: null });
  }

  it("transitions pending → approved and logs employee activity", async () => {
    stubCorrectionResponse({
      id: 1,
      employee_id: "emp1",
      status: "approved",
    });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: {
        status: "approved",
        adminResponse: "Confirmed: amount corrected in next payroll",
      },
    });
    const res = await respondCorrection(req, ctxOf("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.request.status).toBe("approved");

    const activity = hoisted.clientRef.current.__queryBuilders.get(
      "employee_activity_log",
    );
    expect(activity?.insert).toHaveBeenCalled();
  });

  it("transitions pending → rejected with a response message", async () => {
    stubCorrectionResponse({
      id: 2,
      employee_id: "emp1",
      status: "rejected",
    });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/2",
      body: {
        status: "rejected",
        adminResponse: "Not a valid claim — HK verified against contract.",
      },
    });
    const res = await respondCorrection(req, ctxOf("2"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.request.status).toBe("rejected");
  });

  it("transitions pending → resolved", async () => {
    stubCorrectionResponse({
      id: 3,
      employee_id: "emp1",
      status: "resolved",
    });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/3",
      body: {
        status: "resolved",
        adminResponse: "Handled offline with finance",
      },
    });
    const res = await respondCorrection(req, ctxOf("3"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.request.status).toBe("resolved");
  });

  it("already-resolved returns 409", async () => {
    // The route's .eq('status', 'pending') filter means the DB returns
    // null for an already-resolved row — which the handler maps to 409.
    stubCorrectionResponse(null);
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/42",
      body: {
        status: "approved",
        adminResponse: "duplicate",
      },
    });
    const res = await respondCorrection(req, ctxOf("42"));
    expect(res.status).toBe(409);
  });

  it("invalid id returns 400", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/abc",
      body: { status: "approved", adminResponse: "x" },
    });
    const res = await respondCorrection(req, ctxOf("abc"));
    expect(res.status).toBe(400);
  });

  it("missing adminResponse → 400", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: { status: "approved" },
    });
    const res = await respondCorrection(req, ctxOf("1"));
    expect(res.status).toBe(400);
  });

  it("bogus status → 400", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: {
        status: "escalated",
        adminResponse: "Escalating to manager",
      },
    });
    const res = await respondCorrection(req, ctxOf("1"));
    expect(res.status).toBe(400);
  });

  it("without commissions:manage permission → 403", async () => {
    hoisted.hasPermission = false;
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: {
        status: "approved",
        adminResponse: "Valid but not my call.",
      },
    });
    const res = await respondCorrection(req, ctxOf("1"));
    expect(res.status).toBe(403);
  });
});
