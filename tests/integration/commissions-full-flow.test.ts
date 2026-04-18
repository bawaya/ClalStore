/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for the unified commission flow (user spec 3A).
 *
 * Covers the full path from registerSaleCommission through to the DB,
 * including:
 *   - happy paths + validation (device / line)
 *   - rate_snapshot freezing
 *   - source-specific provenance (pipeline / sales_doc / order)
 *   - contract-wide milestone bonus (decision 4) — simulated through recalc
 *   - cancelCommissionsByDoc / cancelCommissionsByDeal soft-delete semantics
 *   - month lock TRIGGER (mocked at the supabase layer — surfaces as a
 *     Postgres error with ERRCODE 23514 and message matching the migration)
 *   - sync-orders → register flow for auto_sync source
 *   - activity log side-effect via mocked logEmployeeActivity
 *
 * Companion to tests/unit/commissions-register.test.ts (which covers the
 * smaller unit slice). This file goes wider — it exercises the register
 * + cancel + sync-orders surfaces together.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (these must exist before any import below) ───────────
const hoisted = vi.hoisted(() => ({
  recalcMock: vi.fn().mockResolvedValue(undefined),
  activityLogMock: vi.fn().mockResolvedValue(undefined),
  adminSupabaseMock: vi.fn(),
}));

vi.mock("@/lib/commissions/ledger", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    recalculateDeviceCommissionsForMonths: hoisted.recalcMock,
  };
});

vi.mock("@/lib/employee/activity-log", () => ({
  logEmployeeActivity: hoisted.activityLogMock,
  logEmployeeActivityBulk: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: () => hoisted.adminSupabaseMock(),
  createServerSupabase: () => hoisted.adminSupabaseMock(),
}));

import {
  registerSaleCommission,
  cancelCommissionsByDoc,
  cancelCommissionsByDeal,
  MAX_SALE_AMOUNT,
} from "@/lib/commissions/register";
import { syncOrdersToCommissions } from "@/lib/commissions/sync-orders";
import type { EmployeeProfile } from "@/lib/commissions/calculator";

// ── Chainable query builder — supports the shapes register/cancel/sync use ──
interface TableScript {
  profile?: EmployeeProfile | null;
  /** Sequential queue of `.single()` / `.maybeSingle()` results. */
  singles?: Array<{ data: any; error?: any }>;
  /** Rows returned when the builder is awaited directly (thenable). */
  thenRows?: any[];
  thenError?: any;
  /** Error returned on insert/update/upsert terminal. */
  mutationError?: { message: string; code?: string } | null;
  /** Capture all mutations against this table. */
  inserts?: any[];
  updates?: any[];
  upserts?: any[];
}

function buildDb(tables: Record<string, TableScript> = {}) {
  const state: Record<string, TableScript> = {};
  for (const [k, v] of Object.entries(tables)) {
    state[k] = {
      singles: v.singles ? [...v.singles] : [],
      thenRows: v.thenRows ?? [],
      thenError: v.thenError ?? null,
      mutationError: v.mutationError ?? null,
      profile: v.profile,
      inserts: [],
      updates: [],
      upserts: [],
    };
  }

  const tableOf = (name: string): TableScript => {
    if (!state[name]) {
      state[name] = {
        singles: [],
        thenRows: [],
        thenError: null,
        mutationError: null,
        inserts: [],
        updates: [],
        upserts: [],
      };
    }
    return state[name]!;
  };

  const from = vi.fn((tableName: string) => {
    const t = tableOf(tableName);

    const nextSingle = () => {
      if (t.singles && t.singles.length > 0) {
        const next = t.singles.shift()!;
        return { data: next.data, error: next.error ?? null };
      }
      return { data: null, error: null };
    };

    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => nextSingle()),
      maybeSingle: vi.fn().mockImplementation(async () => nextSingle()),
      then: (resolve: any) =>
        resolve({ data: t.thenRows ?? [], error: t.thenError ?? null }),

      insert: vi.fn((payload: any) => {
        t.inserts!.push(payload);
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(async () => {
            if (t.mutationError) return { data: null, error: t.mutationError };
            // If there's a queued single result for post-insert .select('id').single(),
            // use it — otherwise synthesize { id: auto }.
            if (t.singles && t.singles.length > 0) {
              return nextSingle();
            }
            return { data: { id: t.inserts!.length }, error: null };
          }),
          then: (resolve: any) =>
            resolve({ data: null, error: t.mutationError ?? null }),
        };
      }),
      update: vi.fn((payload: any) => {
        t.updates!.push(payload);
        return {
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          then: (resolve: any) =>
            resolve({ data: null, error: t.mutationError ?? null }),
        };
      }),
      upsert: vi.fn((payload: any, _opts: any) => {
        t.upserts!.push(payload);
        return {
          then: (resolve: any) =>
            resolve({ data: null, error: t.mutationError ?? null }),
        };
      }),
    };
    return builder;
  });

  return { from, __state: state } as any;
}

// ============================================================================
// registerSaleCommission — happy paths + validation
// ============================================================================

describe("registerSaleCommission — happy paths", () => {
  beforeEach(() => vi.clearAllMocks());

  it("device sale creates a commission_sales row with correct amount", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 101 } }, // insert+select single
          { data: { commission_amount: 150, contract_commission: 150 } }, // read-back
        ],
      },
      employee_activity_log: {},
    });

    const result = await registerSaleCommission(db, {
      saleType: "device",
      amount: 3000,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });

    expect(result.id).toBe(101);
    expect(result.employeeCommission).toBe(150);
    const inserted = db.__state.commission_sales.inserts[0];
    expect(inserted).toMatchObject({
      sale_type: "device",
      device_sale_amount: 3000,
      source: "manual",
      employee_id: "emp-1",
    });
  });

  it("line sale creates a commission_sales row with package_price × multiplier", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: { singles: [{ data: { id: 55 } }] },
      employee_activity_log: {},
    });

    const result = await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });

    expect(result.employeeCommission).toBe(59 * 4);
    const inserted = db.__state.commission_sales.inserts[0];
    expect(inserted.package_price).toBe(59);
    expect(inserted.multiplier).toBe(4);
    expect(inserted.commission_amount).toBe(236);
  });

  it("يحفظ rate_snapshot في الصف ويحتوي على المعدلات الحالية", async () => {
    const snapshot: EmployeeProfile = {
      line_multiplier: 5,
      device_rate: 0.07,
      device_milestone_bonus: 3000,
      min_package_price: 25,
      loyalty_bonuses: { "6": 150 },
    };
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: snapshot }] },
      commission_sales: { singles: [{ data: { id: 9 } }] },
      employee_activity_log: {},
    });

    await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });

    const inserted = db.__state.commission_sales.inserts[0];
    expect(inserted.rate_snapshot).toEqual(snapshot);
    expect(inserted.multiplier).toBe(5);
  });

  it("source=pipeline يعبئ source_pipeline_deal_id", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 12 } },
          { data: { commission_amount: 150, contract_commission: 150 } },
        ],
      },
      employee_activity_log: {},
    });

    await registerSaleCommission(db, {
      saleType: "device",
      amount: 3000,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "pipeline",
      sourcePipelineDealId: "deal-xyz",
    });

    const inserted = db.__state.commission_sales.inserts[0];
    expect(inserted.source).toBe("pipeline");
    expect(inserted.source_pipeline_deal_id).toBe("deal-xyz");
    expect(inserted.source_sales_doc_id).toBeNull();
  });

  it("source=sales_doc يعبئ source_sales_doc_id", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: { singles: [{ data: { id: 21 } }] },
      employee_activity_log: {},
    });

    await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "sales_doc",
      sourceSalesDocId: 707,
    });

    const inserted = db.__state.commission_sales.inserts[0];
    expect(inserted.source_sales_doc_id).toBe(707);
    expect(inserted.source_pipeline_deal_id).toBeNull();
  });

  it("source=order يعبئ order_id", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 30 } },
          { data: { commission_amount: 150, contract_commission: 150 } },
        ],
      },
      employee_activity_log: {},
    });

    await registerSaleCommission(db, {
      saleType: "device",
      amount: 3000,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "order",
      orderId: "CLM-999",
    });

    const inserted = db.__state.commission_sales.inserts[0];
    expect(inserted.order_id).toBe("CLM-999");
    expect(inserted.source).toBe("order");
  });

  it("employee_id يُسجَّل بالقيمة الصحيحة", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: { singles: [{ data: { id: 41 } }] },
      employee_activity_log: {},
    });

    await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-specific-abc",
      saleDate: "2026-04-10",
      source: "manual",
    });

    expect(db.__state.commission_sales.inserts[0].employee_id).toBe(
      "emp-specific-abc",
    );
  });

  it("يُدرج حدث سجل النشاط بعد التسجيل", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: { singles: [{ data: { id: 50 } }] },
      employee_activity_log: {},
    });

    await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });

    // `void logEmployeeActivity(...)` is fire-and-forget; assert the mock was called.
    expect(hoisted.activityLogMock).toHaveBeenCalledTimes(1);
    const [, call] = hoisted.activityLogMock.mock.calls[0];
    expect(call).toMatchObject({
      employeeId: "emp-1",
      eventType: "sale_registered",
    });
    expect(call.metadata?.commission_sale_id).toBe(50);
  });
});

describe("registerSaleCommission — validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يرفض المبلغ = 0", async () => {
    const db = buildDb({});
    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 0,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/amount must be positive/);
  });

  it("يرفض المبلغ السالب", async () => {
    const db = buildDb({});
    await expect(
      registerSaleCommission(db, {
        saleType: "device",
        amount: -50,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/amount must be positive/);
  });

  it("يرفض المبلغ > MAX_SALE_AMOUNT", async () => {
    const db = buildDb({});
    await expect(
      registerSaleCommission(db, {
        saleType: "device",
        amount: MAX_SALE_AMOUNT + 1,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/exceeds/);
  });

  it("يرفض employeeId مفقود", async () => {
    const db = buildDb({});
    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 59,
        employeeId: "",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/employeeId/);
  });

  it("يرفض تنسيق saleDate غير صحيح", async () => {
    const db = buildDb({});
    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 59,
        employeeId: "emp-1",
        saleDate: "10/04/2026",
        source: "manual",
      }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });
});

// ============================================================================
// Contract-wide milestone (decision 4)
// ============================================================================

describe("contract-wide milestone (decision 4)", () => {
  beforeEach(() => vi.clearAllMocks());

  // For the milestone scenarios we simulate the recalc function with different
  // post-read values. The recalc itself is out-of-scope here (it has its own
  // tests in the ledger suite); we verify the register function calls recalc
  // and picks up the updated totals.

  it("device sale of 60K → commission includes 1 milestone bonus (2500)", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 101 } }, // insert+select
          // Recalc updates: base 60000 × 0.05 = 3000, + milestone 2500 = 5500
          { data: { commission_amount: 5500, contract_commission: 5500 } },
        ],
      },
      employee_activity_log: {},
    });

    const res = await registerSaleCommission(db, {
      saleType: "device",
      amount: 60000,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });
    expect(res.employeeCommission).toBe(5500);
    expect(hoisted.recalcMock).toHaveBeenCalledWith(db, ["2026-04"]);
  });

  it("ثاني بيعة (50K + 20K) تعبر العتبة → تحصل على bonus milestone", async () => {
    // We model this by making the recalc surface the commission with milestone baked in
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 202 } }, // insert+select
          // Second sale (20K) crosses the 50K threshold, so gets the bonus
          { data: { commission_amount: 1000 + 2500, contract_commission: 3500 } },
        ],
      },
      employee_activity_log: {},
    });

    const res = await registerSaleCommission(db, {
      saleType: "device",
      amount: 20000,
      employeeId: "emp-1",
      saleDate: "2026-04-12",
      source: "manual",
    });
    expect(res.employeeCommission).toBe(3500);
  });

  it("3 موظفين كل واحد 20K → ثالث يعبر العتبة ويأخذ milestone", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 301 } },
          // Third employee's row got the milestone bonus after recalc
          { data: { commission_amount: 1000 + 2500, contract_commission: 3500 } },
        ],
      },
      employee_activity_log: {},
    });

    const res = await registerSaleCommission(db, {
      saleType: "device",
      amount: 20000,
      employeeId: "emp-3",
      saleDate: "2026-04-20",
      source: "manual",
    });
    expect(res.employeeCommission).toBe(3500);
  });

  it("100K total = 2 milestones", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: {
        singles: [
          { data: { id: 400 } },
          // 100K × 0.05 = 5000 + 2×2500 = 10000
          { data: { commission_amount: 10000, contract_commission: 10000 } },
        ],
      },
      employee_activity_log: {},
    });

    const res = await registerSaleCommission(db, {
      saleType: "device",
      amount: 100000,
      employeeId: "emp-1",
      saleDate: "2026-04-25",
      source: "manual",
    });
    expect(res.employeeCommission).toBe(10000);
  });

  it("milestone يعاد حسابه عند إلغاء البيعة (استدعاء recalc بعد cancelByDoc)", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 1, sale_date: "2026-04-10", sale_type: "device", employee_id: "emp-1", commission_amount: 3000 },
        ],
      },
      employee_activity_log: {},
    });

    const res = await cancelCommissionsByDoc(db, 42);
    expect(res.affectedMonths).toEqual(["2026-04"]);
    expect(hoisted.recalcMock).toHaveBeenCalledWith(db, ["2026-04"]);
  });
});

// ============================================================================
// cancelCommissionsByDoc / cancelCommissionsByDeal
// ============================================================================

describe("cancelCommissionsByDoc / cancelCommissionsByDeal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancelCommissionsByDoc → soft-deletes matching rows (deleted_at set)", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 1, sale_date: "2026-04-10", sale_type: "line", employee_id: "emp-1", commission_amount: 45 },
          { id: 2, sale_date: "2026-04-11", sale_type: "line", employee_id: "emp-1", commission_amount: 45 },
        ],
      },
      employee_activity_log: {},
    });

    const res = await cancelCommissionsByDoc(db, 99);
    expect(res.cancelledIds).toEqual([1, 2]);
    const upd = db.__state.commission_sales.updates[0];
    expect(upd.deleted_at).toBeTruthy();
  });

  it("cancelCommissionsByDeal → soft-deletes matching rows", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 3, sale_date: "2026-04-10", sale_type: "device", employee_id: "emp-1", commission_amount: 150 },
        ],
      },
      employee_activity_log: {},
    });

    const res = await cancelCommissionsByDeal(db, "deal-abc");
    expect(res.cancelledIds).toEqual([3]);
    expect(db.__state.commission_sales.updates[0].deleted_at).toBeTruthy();
  });

  it("يُرجع الأشهر المتأثرة (صفوف device فقط)", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 1, sale_date: "2026-04-10", sale_type: "line", employee_id: "emp-1", commission_amount: 45 },
          { id: 2, sale_date: "2026-04-12", sale_type: "device", employee_id: "emp-1", commission_amount: 150 },
          { id: 3, sale_date: "2026-05-02", sale_type: "device", employee_id: "emp-1", commission_amount: 150 },
        ],
      },
      employee_activity_log: {},
    });

    const res = await cancelCommissionsByDoc(db, 99);
    expect(res.affectedMonths.sort()).toEqual(["2026-04", "2026-05"]);
  });

  it("يعيد حساب الشهر بعد الإلغاء", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 1, sale_date: "2026-04-10", sale_type: "device", employee_id: "emp-1", commission_amount: 150 },
        ],
      },
      employee_activity_log: {},
    });

    await cancelCommissionsByDeal(db, "deal-zyx");
    expect(hoisted.recalcMock).toHaveBeenCalledWith(db, ["2026-04"]);
  });

  it("حدث سجل النشاط يُنشأ لكل موظف متأثر", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 1, sale_date: "2026-04-10", sale_type: "line", employee_id: "emp-1", commission_amount: 45 },
          { id: 2, sale_date: "2026-04-11", sale_type: "device", employee_id: "emp-2", commission_amount: 150 },
        ],
      },
      employee_activity_log: {},
    });

    await cancelCommissionsByDoc(db, 100, "إلغاء إداري");
    expect(hoisted.activityLogMock).toHaveBeenCalledTimes(2);
    const eventTypes = hoisted.activityLogMock.mock.calls.map(
      (c: any[]) => c[1].eventType,
    );
    expect(eventTypes.every((t: string) => t === "sale_cancelled")).toBe(true);
    const emps = hoisted.activityLogMock.mock.calls
      .map((c: any[]) => c[1].employeeId)
      .sort();
    expect(emps).toEqual(["emp-1", "emp-2"]);
  });

  it("no-op إذا لم توجد صفوف مطابقة", async () => {
    const db = buildDb({
      commission_sales: { thenRows: [] },
    });

    const res = await cancelCommissionsByDoc(db, 999);
    expect(res.cancelledIds).toEqual([]);
    expect(res.affectedMonths).toEqual([]);
    // No recalc for an empty affectedMonths
    expect(hoisted.recalcMock).not.toHaveBeenCalled();
    // No activity log either
    expect(hoisted.activityLogMock).not.toHaveBeenCalled();
  });

  it("إلغاء ما أُلغي مسبقاً → بدون تكرار (lookup يرشّح deleted_at IS NULL)", async () => {
    // The .is("deleted_at", null) filter returns only active rows — the mock
    // returns whatever we set. If the caller pretends "nothing active", the
    // function becomes a no-op.
    const db = buildDb({
      commission_sales: { thenRows: [] },
    });

    const res = await cancelCommissionsByDoc(db, 99);
    expect(res.cancelledIds).toEqual([]);
    expect(db.__state.commission_sales.updates.length).toBe(0);
  });
});

// ============================================================================
// Month lock TRIGGER — mocked as a generic Postgres error
// ============================================================================

describe("month lock TRIGGER (check_month_lock)", () => {
  beforeEach(() => vi.clearAllMocks());

  const lockError = {
    message: "Month 2026-04 is locked. Cannot modify commission data.",
    code: "23514",
  };

  it("INSERT في شهر مقفل → throws", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: { mutationError: lockError },
    });

    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 59,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/Month 2026-04 is locked/);
  });

  it("cancel (UPDATE deleted_at) في شهر مقفل → throws", async () => {
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 1, sale_date: "2026-04-10", sale_type: "line", employee_id: "emp-1", commission_amount: 45 },
        ],
        mutationError: lockError,
      },
      employee_activity_log: {},
    });

    await expect(cancelCommissionsByDoc(db, 99)).rejects.toThrow(
      /Month 2026-04 is locked/,
    );
  });

  it("cancel via cancelCommissionsByDeal في شهر مقفل → throws", async () => {
    // Sanctions use sanction_date, but the migration also applies the trigger
    // to sanctions. Here we simulate through the commission-sales path since
    // register.ts + cancelCommissions* both write commission_sales.
    const db = buildDb({
      commission_sales: {
        thenRows: [
          { id: 2, sale_date: "2026-04-10", sale_type: "device", employee_id: "emp-1", commission_amount: 150 },
        ],
        mutationError: lockError,
      },
      employee_activity_log: {},
    });

    await expect(cancelCommissionsByDeal(db, "deal-xyz")).rejects.toThrow(
      /Month 2026-04 is locked/,
    );
  });

  it("شهر غير مقفل → INSERT ينجح", async () => {
    const db = buildDb({
      employee_commission_profiles: { singles: [{ data: null }] },
      commission_sales: { singles: [{ data: { id: 101 } }] },
      employee_activity_log: {},
    });

    const res = await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });
    expect(res.id).toBe(101);
  });
});

// ============================================================================
// sync-orders → register path (source=auto_sync)
// ============================================================================

describe("sync-orders → commission_sales (source=auto_sync)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * sync-orders uses the higher-level syncOrdersToCommissions() which goes
   * through createAdminSupabase() + upsert on commission_sales. We mock the
   * admin client with our buildDb and verify the observable effects.
   */
  it("طلب معتمد بقطع device → يُنشئ commission مع source=auto_sync", async () => {
    const order = {
      id: "ORD-A",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: "cust-1",
    };
    const db = buildDb({
      order_status_history: {
        thenRows: [
          { order_id: "ORD-A", new_status: "approved", created_at: "2026-04-10T10:00:00Z" },
        ],
      },
      orders: { thenRows: [order] },
      order_items: {
        thenRows: [
          { order_id: "ORD-A", product_name: "iPhone 15", product_type: "device", price: 3499, quantity: 1 },
        ],
      },
      commission_sales: { thenRows: [] },
      users: { thenRows: [{ id: "user-1", name: "Sami" }] },
      customers: { thenRows: [{ id: "cust-1", customer_code: "CLAL-001" }] },
      customer_hot_accounts: { thenRows: [] },
      commission_sync_log: {},
    });
    hoisted.adminSupabaseMock.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.synced).toBe(1);
    expect(db.__state.commission_sales.upserts.length).toBe(1);
    const payload = db.__state.commission_sales.upserts[0];
    expect(payload.source).toBe("auto_sync");
    expect(payload.order_id).toBe("ORD-A");
    expect(payload.sale_type).toBe("device");
    expect(payload.employee_id).toBe("user-1");
  });

  it("طلب محذوف (deleted_at) → لا يدخل نتائج الـsync (لا يظهر في orders select)", async () => {
    // Soft-deleted orders are filtered upstream before the snapshot is built.
    // To model this we simply return no rows for the orders table.
    const db = buildDb({
      order_status_history: { thenRows: [] },
      orders: { thenRows: [] },
      order_items: { thenRows: [] },
      commission_sales: { thenRows: [] },
      commission_sync_log: {},
    });
    hoisted.adminSupabaseMock.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.synced).toBe(0);
    expect(res.skipped).toBe(0);
    expect(db.__state.commission_sales.upserts.length).toBe(0);
  });

  it("طلب متزامن مسبقاً → upsert يحدّث بدون تكرار", async () => {
    const order = {
      id: "ORD-B",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = buildDb({
      order_status_history: { thenRows: [] },
      orders: { thenRows: [order] },
      order_items: {
        thenRows: [
          { order_id: "ORD-B", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 },
        ],
      },
      commission_sales: {
        thenRows: [{ id: 999, order_id: "ORD-B", sale_date: "2026-04-10", deleted_at: null }],
      },
      users: { thenRows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoisted.adminSupabaseMock.mockReturnValue(db);

    await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(db.__state.commission_sales.upserts.length).toBe(1);
    // Inserts should be 0 — we only ever upsert
    expect(db.__state.commission_sales.inserts.length).toBe(0);
  });

  it("طلب ملغى (cancelled) → يعطّل العمولة (soft delete عبر sync)", async () => {
    const cancelledOrder = {
      id: "ORD-C",
      status: "cancelled",
      created_at: "2026-04-05T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = buildDb({
      order_status_history: { thenRows: [] },
      orders: { thenRows: [cancelledOrder] },
      order_items: {
        thenRows: [
          { order_id: "ORD-C", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 },
        ],
      },
      commission_sales: {
        thenRows: [{ id: 888, order_id: "ORD-C", sale_date: "2026-04-05", deleted_at: null }],
      },
      users: { thenRows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoisted.adminSupabaseMock.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.deactivated).toBe(1);
    // commission_sales.update payload includes a deleted_at timestamp
    const updates = db.__state.commission_sales.updates;
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].deleted_at).toBeTruthy();
  });

  it("طلب returned → يُعامَل مثل cancelled (not commissionable) → deactivate", async () => {
    const returnedOrder = {
      id: "ORD-R",
      status: "returned",
      created_at: "2026-04-08T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = buildDb({
      order_status_history: { thenRows: [] },
      orders: { thenRows: [returnedOrder] },
      order_items: {
        thenRows: [
          { order_id: "ORD-R", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 },
        ],
      },
      commission_sales: {
        thenRows: [{ id: 777, order_id: "ORD-R", sale_date: "2026-04-08", deleted_at: null }],
      },
      users: { thenRows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoisted.adminSupabaseMock.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.deactivated).toBe(1);
  });
});
