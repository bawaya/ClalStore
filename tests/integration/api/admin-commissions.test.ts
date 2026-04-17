/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeCommissionSale,
  makeCommissionSanction,
  makeCommissionTarget,
  makeCommissionEmployee,
  makeEmployeeCommissionProfile,
  makeUser,
} from "@/tests/helpers";

// ── Shared data ────────────────────────────────────────
const sale = makeCommissionSale({ id: 1, sale_type: "line", package_price: 59, commission_amount: 45 });
const sanction = makeCommissionSanction({ id: 1, amount: 50 });
const target = makeCommissionTarget({ id: 1, month: "2026-04", target_total: 15000 });
const employee = makeCommissionEmployee({ id: 1, name: "Sami", phone: "050", token: "tok-123" });
const profile = makeEmployeeCommissionProfile({ user_id: "u-emp1" });
const user = makeUser({ id: "u-emp1", name: "Admin User" });

// ── Hoisted shared state (available inside vi.mock factories) ─
const hoisted = vi.hoisted(() => ({
  adminUser: {
    id: "u1",
    email: "admin@test.com",
    role: "super_admin",
    appUserId: "app-u1",
    name: "Admin",
  },
  clientRef: { current: null as any },
}));

// ── Supabase client ────────────────────────────────────
import type { MockSupabaseClient } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase", () => {
  // Store initial client in hoisted ref so auth mocks can access it
  return {
    createServerSupabase: vi.fn(() => hoisted.clientRef.current),
    createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
  };
});

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue(hoisted.adminUser),
    withAdminAuth: (handler: any) => {
      return async (req: any) => {
        return handler(req, hoisted.clientRef.current, hoisted.adminUser);
      };
    },
    withPermission: (_m: string, _a: string, handler: any) => {
      return async (req: any) => {
        return handler(req, hoisted.clientRef.current, hoisted.adminUser);
      };
    },
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

// ── Commission calculator mock ─────────────────────────
vi.mock("@/lib/commissions/calculator", () => ({
  calcDualCommission: vi.fn().mockReturnValue({
    contractCommission: 45,
    employeeCommission: 30,
  }),
  calcDeviceCommission: vi.fn().mockReturnValue({
    milestoneCount: 0,
    milestoneBonus: 0,
    commission: 0,
    nextMilestoneAt: 15000,
  }),
  calcLoyaltyBonus: vi.fn().mockReturnValue({
    earnedSoFar: 0,
    isInLoyaltyPeriod: false,
    daysRemaining: 0,
  }),
  calcMonthlySummary: vi.fn().mockReturnValue({
    linesCommission: 450,
    devicesCommission: 0,
    loyaltyBonus: 0,
    grossCommission: 450,
    totalSanctions: 50,
    netCommission: 400,
    targetAmount: 15000,
    targetProgress: 3,
  }),
}));

vi.mock("@/lib/commissions/sync-orders", () => ({
  getLastSyncInfo: vi.fn().mockResolvedValue({ last_synced_at: null, count: 0 }),
}));

vi.mock("@/lib/commissions/ledger", () => ({
  recalculateDeviceCommissionsForMonths: vi.fn().mockResolvedValue(undefined),
  resolveCommissionEmployeeFilter: vi.fn().mockResolvedValue({
    notFound: false,
    employeeId: null,
    employeeName: null,
    targetKeys: ["app-u1"],
  }),
  resolveLinkedAppUserId: vi.fn().mockResolvedValue(null),
  getCommissionTarget: vi.fn().mockResolvedValue({ id: 1, month: "2026-04", target_total: 15000, is_locked: false }),
  getCommissionTargetKey: vi.fn().mockReturnValue("app-u1"),
  COMMISSION_CONTRACT_TARGET_KEY: "__contract__",
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, resetAt: Date.now() + 3600000 }),
}));

import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";

// ── Import routes ──────────────────────────────────────
import { GET as salesGET, POST as salesPOST, PUT as salesPUT, DELETE as salesDELETE } from "@/app/api/admin/commissions/sales/route";
import { GET as sanctionsGET, POST as sanctionsPOST, DELETE as sanctionsDELETE } from "@/app/api/admin/commissions/sanctions/route";
import { GET as targetsGET, POST as targetsPOST, PATCH as targetsPATCH } from "@/app/api/admin/commissions/targets/route";
import { GET as dashboardGET } from "@/app/api/admin/commissions/dashboard/route";
import { GET as exportGET } from "@/app/api/admin/commissions/export/route";
import { GET as analyticsGET } from "@/app/api/admin/commissions/analytics/route";
import { GET as profilesGET, POST as profilesPOST, DELETE as profilesDELETE } from "@/app/api/admin/commissions/profiles/route";
import { GET as employeesGET, POST as employeesPOST, PATCH as employeesPATCH, DELETE as employeesDELETE } from "@/app/api/admin/commissions/employees/route";

// ── Tests ──────────────────────────────────────────────
describe("Admin Commissions API", () => {
  let client: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockSupabaseClient({
      commission_sales: { data: [{ id: 1, sale_type: "line", package_price: 59, commission_amount: 45, sale_date: "2026-04-15", deleted_at: null }] },
      commission_sanctions: { data: [{ id: 1, amount: 50, sanction_date: "2026-04-15", deleted_at: null }] },
      commission_targets: { data: [{ id: 1, month: "2026-04", target_total: 15000, is_locked: false }] },
      commission_employees: { data: [{ id: 1, name: "Sami", phone: "050", token: "tok-123" }] },
      employee_commission_profiles: { data: [{ user_id: "u-emp1", line_multiplier: 1.0 }] },
      users: { data: [{ id: "u-emp1", name: "Admin User", email: "emp@test.com", role: "sales", status: "active" }] },
      orders: { data: [] },
    });
    hoisted.clientRef.current = client;
    (createAdminSupabase as any).mockImplementation(() => client);
    (createServerSupabase as any).mockImplementation(() => client);
    (requireAdmin as any).mockResolvedValue(hoisted.adminUser);
    // Reset env for bearer token tests
    process.env.COMMISSION_API_TOKEN = "test-token-123";
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/sales
  // ═══════════════════════════════════════════════
  describe("Sales — /api/admin/commissions/sales", () => {
    describe("GET", () => {
      it("returns paginated sales", async () => {
        const req = createMockRequest({
          url: "/api/admin/commissions/sales",
          headers: { authorization: "Bearer test-token-123" },
        });
        const res = await salesGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 401 without valid auth", async () => {
        const { NextResponse } = await import("next/server");
        (requireAdmin as any).mockResolvedValue(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
        const req = createMockRequest({
          url: "/api/admin/commissions/sales",
          headers: { authorization: "Bearer wrong-token" },
        });
        process.env.COMMISSION_API_TOKEN = "correct-token";
        const res = await salesGET(req);

        expect(res.status).toBe(401);
      });
    });

    describe("POST", () => {
      it("creates a line sale", async () => {
        const req = createMockRequest({
          method: "POST",
          headers: { authorization: "Bearer test-token-123" },
          body: {
            sale_type: "line",
            sale_date: "2026-04-15",
            customer_name: "Ahmad",
            package_price: 59,
          },
        });
        const res = await salesPOST(req);
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.success).toBe(true);
      });

      it("returns 400 when sale_type missing", async () => {
        const req = createMockRequest({
          method: "POST",
          headers: { authorization: "Bearer test-token-123" },
          body: { sale_date: "2026-04-15", package_price: 59 },
        });
        const res = await salesPOST(req);

        expect(res.status).toBe(400);
      });

      it("returns 400 when sale_type is invalid", async () => {
        const req = createMockRequest({
          method: "POST",
          headers: { authorization: "Bearer test-token-123" },
          body: { sale_type: "invalid", sale_date: "2026-04-15", package_price: 59 },
        });
        const res = await salesPOST(req);

        expect(res.status).toBe(400);
      });

      it("returns 400 when package_price missing for line sale", async () => {
        const req = createMockRequest({
          method: "POST",
          headers: { authorization: "Bearer test-token-123" },
          body: { sale_type: "line", sale_date: "2026-04-15" },
        });
        const res = await salesPOST(req);

        expect(res.status).toBe(400);
      });
    });

    describe("PUT", () => {
      it("updates a sale record", async () => {
        const req = createMockRequest({
          method: "PUT",
          headers: { authorization: "Bearer test-token-123" },
          body: { id: 1, customer_name: "Updated" },
        });
        const res = await salesPUT(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 400 when id is missing", async () => {
        const req = createMockRequest({
          method: "PUT",
          headers: { authorization: "Bearer test-token-123" },
          body: { customer_name: "No ID" },
        });
        const res = await salesPUT(req);

        expect(res.status).toBe(400);
      });
    });

    describe("DELETE", () => {
      it("soft-deletes a sale record", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/sales",
          searchParams: { id: "1" },
          headers: { authorization: "Bearer test-token-123" },
        });
        const res = await salesDELETE(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.deleted).toBe(true);
      });

      it("returns 400 when id is missing", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/sales",
          headers: { authorization: "Bearer test-token-123" },
        });
        const res = await salesDELETE(req);

        expect(res.status).toBe(400);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/sanctions
  // ═══════════════════════════════════════════════
  describe("Sanctions — /api/admin/commissions/sanctions", () => {
    describe("GET", () => {
      it("returns sanctions list", async () => {
        const req = createMockRequest({ url: "/api/admin/commissions/sanctions" });
        const res = await sanctionsGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });
    });

    describe("POST", () => {
      it("creates a sanction", async () => {
        const req = createMockRequest({
          method: "POST",
          body: {
            sanction_type: "deduction",
            sanction_date: "2026-04-15",
            amount: 2500,
            description: "Test sanction",
          },
        });
        const res = await sanctionsPOST(req);
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.success).toBe(true);
      });

      it("returns 400 when sanction_type missing", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { sanction_date: "2026-04-15" },
        });
        const res = await sanctionsPOST(req);

        expect(res.status).toBe(400);
      });
    });

    describe("DELETE", () => {
      it("soft-deletes a sanction", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/sanctions",
          searchParams: { id: "1" },
        });
        const res = await sanctionsDELETE(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.deleted).toBe(true);
      });

      it("returns 400 when id is missing", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/sanctions",
        });
        const res = await sanctionsDELETE(req);

        expect(res.status).toBe(400);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/targets
  // ═══════════════════════════════════════════════
  describe("Targets — /api/admin/commissions/targets", () => {
    describe("GET", () => {
      it("returns target for a month", async () => {
        const req = createMockRequest({
          url: "/api/admin/commissions/targets",
          searchParams: { month: "2026-04" },
        });
        const res = await targetsGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 400 when month is missing", async () => {
        const req = createMockRequest({
          url: "/api/admin/commissions/targets",
        });
        const res = await targetsGET(req);

        expect(res.status).toBe(400);
      });
    });

    describe("POST", () => {
      it("upserts a target", async () => {
        const req = createMockRequest({
          method: "POST",
          body: {
            month: "2026-04",
            target_lines_amount: 5000,
            target_devices_amount: 10000,
            target_total: 15000,
          },
        });
        const res = await targetsPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 400 when month is missing", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { target_total: 15000 },
        });
        const res = await targetsPOST(req);

        expect(res.status).toBe(400);
      });

      it("returns 403 when target is locked", async () => {
        // Override maybeSingle to return locked target
        const builder = client.__queryBuilders.get("commission_targets")!;
        builder.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, is_locked: true },
          error: null,
        });

        const req = createMockRequest({
          method: "POST",
          body: { month: "2026-04", target_total: 20000 },
        });
        const res = await targetsPOST(req);

        expect(res.status).toBe(403);

        // Reset
        builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      });
    });

    describe("PATCH", () => {
      it("locks a target", async () => {
        const builder = client.__queryBuilders.get("commission_targets")!;
        builder.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, is_locked: false },
          error: null,
        });

        const req = createMockRequest({
          method: "PATCH",
          body: { month: "2026-04", action: "lock" },
        });
        const res = await targetsPATCH(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);

        builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      });

      it("returns 400 when action is invalid", async () => {
        const req = createMockRequest({
          method: "PATCH",
          body: { month: "2026-04", action: "invalid" },
        });
        const res = await targetsPATCH(req);

        expect(res.status).toBe(400);
      });

      it("returns 404 when target not found", async () => {
        const builder = client.__queryBuilders.get("commission_targets")!;
        builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

        const req = createMockRequest({
          method: "PATCH",
          body: { month: "2026-04", action: "lock" },
        });
        const res = await targetsPATCH(req);

        expect(res.status).toBe(404);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/dashboard
  // ═══════════════════════════════════════════════
  describe("Dashboard — /api/admin/commissions/dashboard", () => {
    describe("GET", () => {
      it("returns full dashboard data", async () => {
        const req = createMockRequest({
          url: "/api/admin/commissions/dashboard",
          searchParams: { month: "2026-04" },
        });
        const res = await dashboardGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.summary).toBeDefined();
        expect(body.month).toBe("2026-04");
      });

      it("returns 401 when not authenticated", async () => {
        const { NextResponse } = await import("next/server");
        (requireAdmin as any).mockResolvedValue(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
        process.env.COMMISSION_API_TOKEN = "";
        const req = createMockRequest({
          url: "/api/admin/commissions/dashboard",
        });
        const res = await dashboardGET(req);

        expect(res.status).toBe(401);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/export
  // ═══════════════════════════════════════════════
  describe("Export — /api/admin/commissions/export", () => {
    describe("GET", () => {
      it("returns CSV file", async () => {
        const req = createMockRequest({
          url: "/api/admin/commissions/export",
          searchParams: { month: "2026-04" },
        });
        const res = await exportGET(req);

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/csv");
        expect(res.headers.get("Content-Disposition")).toContain("commissions-2026-04.csv");
      });

      it("returns 401 when not authenticated", async () => {
        const { NextResponse } = await import("next/server");
        (requireAdmin as any).mockResolvedValue(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
        const req = createMockRequest({
          url: "/api/admin/commissions/export",
        });
        const res = await exportGET(req);

        expect(res.status).toBe(401);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/analytics
  // ═══════════════════════════════════════════════
  describe("Analytics — /api/admin/commissions/analytics", () => {
    describe("GET", () => {
      it("returns monthly and quarterly analytics", async () => {
        const req = createMockRequest({
          url: "/api/admin/commissions/analytics",
          searchParams: { months: "6" },
        });
        const res = await analyticsGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.monthly).toBeDefined();
        expect(body.quarterly).toBeDefined();
        expect(body.kpi).toBeDefined();
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/profiles
  // ═══════════════════════════════════════════════
  describe("Profiles — /api/admin/commissions/profiles", () => {
    describe("GET", () => {
      it("returns employees with their profiles", async () => {
        const req = createMockRequest({ url: "/api/admin/commissions/profiles" });
        const res = await profilesGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.employees).toBeDefined();
      });
    });

    describe("POST", () => {
      it("upserts a commission profile", async () => {
        const req = createMockRequest({
          method: "POST",
          body: {
            user_id: "550e8400-e29b-41d4-a716-446655440000",
            line_multiplier: 5,
            device_rate: 0.05,
            device_milestone_bonus: 500,
            min_package_price: 39,
          },
        });
        const res = await profilesPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 400 for invalid user_id", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { user_id: "not-a-uuid", line_multiplier: 5 },
        });
        const res = await profilesPOST(req);

        expect(res.status).toBe(400);
      });
    });

    describe("DELETE", () => {
      it("deletes a profile", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/profiles",
          searchParams: { user_id: "u-emp1" },
        });
        const res = await profilesDELETE(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.deleted).toBe(true);
      });

      it("returns 400 when user_id is missing", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/profiles",
        });
        const res = await profilesDELETE(req);

        expect(res.status).toBe(400);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/commissions/employees
  // ═══════════════════════════════════════════════
  describe("Employees — /api/admin/commissions/employees", () => {
    describe("GET", () => {
      it("returns all commission employees", async () => {
        const req = createMockRequest({ url: "/api/admin/commissions/employees" });
        const res = await employeesGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.employees).toBeDefined();
      });
    });

    describe("POST", () => {
      it("creates a new employee", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { name: "New Employee", phone: "0501234567", role: "sales" },
        });
        const res = await employeesPOST(req);
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.success).toBe(true);
      });

      it("updates an existing employee when id is present", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { id: 1, name: "Updated Name", phone: "0509876543" },
        });
        const res = await employeesPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 400 when name is too short", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { name: "A" },
        });
        const res = await employeesPOST(req);

        expect(res.status).toBe(400);
      });
    });

    describe("PATCH", () => {
      it("regenerates an employee token", async () => {
        const req = createMockRequest({
          method: "PATCH",
          body: { id: 1 },
        });
        const res = await employeesPATCH(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      });

      it("returns 400 when id is missing", async () => {
        const req = createMockRequest({
          method: "PATCH",
          body: {},
        });
        const res = await employeesPATCH(req);

        expect(res.status).toBe(400);
      });
    });

    describe("DELETE", () => {
      it("deletes an employee", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/employees",
          searchParams: { id: "1" },
        });
        const res = await employeesDELETE(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.deleted).toBe(true);
      });

      it("returns 400 when id is missing", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/commissions/employees",
        });
        const res = await employeesDELETE(req);

        expect(res.status).toBe(400);
      });
    });
  });
});
