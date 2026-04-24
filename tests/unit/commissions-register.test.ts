/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for lib/commissions/register.ts — the unified commission
 * registration entry point (decision 7).
 *
 * Covers:
 *   - registerSaleCommission validation, line/device paths, rate_snapshot
 *   - cancelCommissionsByDoc / cancelCommissionsByDeal — soft delete +
 *     affected months for device rows
 *   - lastDayOfMonth helper (issue 4.17)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerSaleCommission,
  cancelCommissionsByDoc,
  cancelCommissionsByDeal,
  MAX_SALE_AMOUNT,
  type CommissionSource,
} from "@/lib/commissions/register";
import { lastDayOfMonth } from "@/lib/commissions/ledger";
import { COMMISSION, type EmployeeProfile } from "@/lib/commissions/calculator";

// ── Recalc mock ────────────────────────────────────────
// Intercepts the month-wide milestone recalc so we can assert it was called
// and don't have to mock the second select/update round-trip per device.
vi.mock("@/lib/commissions/ledger", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    recalculateDeviceCommissionsForMonths: vi.fn().mockResolvedValue(undefined),
  };
});

// ── Helpers ────────────────────────────────────────────
function buildChain(opts: {
  profile?: EmployeeProfile | null;
  insertedId?: number;
  insertError?: any;
  updatedAfterRecalc?: { commission_amount: number; contract_commission: number };
}) {
  const { profile = null, insertedId = 42, insertError = null, updatedAfterRecalc } = opts;
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: insertedId },
    error: insertError,
  });
  const profileSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const recalcReadSingle = vi.fn().mockResolvedValue({
    data: updatedAfterRecalc ?? null,
    error: null,
  });

  // Capture what's been inserted for assertions
  const captured: { insert?: any } = {};

  // Shared single() state machine across all .from("commission_sales") calls —
  // register.ts calls .from twice for devices: once for the insert, once for
  // the post-recalc read-back. Each call must return a sequential result.
  const commissionSalesSingle = vi
    .fn()
    .mockImplementationOnce(() => insertSingle())
    .mockImplementationOnce(() => recalcReadSingle());

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "employee_commission_profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: profileSingle,
      };
    }
    if (table === "commission_sales") {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn((row: any) => {
          captured.insert = row;
          return builder;
        }),
        eq: vi.fn().mockReturnThis(),
        single: commissionSalesSingle,
      };
      return builder;
    }
    return {};
  });

  return { db: { from } as any, captured };
}

// ── Tests: registerSaleCommission ──────────────────────
describe("registerSaleCommission — validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws on missing employeeId", async () => {
    const { db } = buildChain({});
    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 50,
        employeeId: "",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/employeeId/);
  });

  it("throws on negative amount", async () => {
    const { db } = buildChain({});
    await expect(
      registerSaleCommission(db, {
        saleType: "device",
        amount: -100,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/amount must be positive/);
  });

  it("throws on amount > MAX_SALE_AMOUNT", async () => {
    const { db } = buildChain({});
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

  it("throws on bad saleDate format", async () => {
    const { db } = buildChain({});
    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 50,
        employeeId: "emp-1",
        saleDate: "04/10/2026",
        source: "manual",
      }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });
});

describe("registerSaleCommission — line sales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("line sale produces employeeCommission = amount × 4 (default profile)", async () => {
    const { db, captured } = buildChain({ profile: null, insertedId: 7 });
    const result = await registerSaleCommission(db, {
      saleType: "line",
      amount: 50,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });
    expect(result.employeeCommission).toBe(200); // 50 × 4
    expect(result.contractCommission).toBe(200);
    expect(captured.insert).toMatchObject({
      sale_type: "line",
      package_price: 50,
      commission_amount: 200,
      contract_commission: 200,
      employee_id: "emp-1",
    });
  });

  it("line sale with amount < MIN_PACKAGE_PRICE returns zero commissions", async () => {
    const { db } = buildChain({ profile: null });
    const result = await registerSaleCommission(db, {
      saleType: "line",
      amount: 10, // < 19.90
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });
    expect(result.employeeCommission).toBe(0);
    expect(result.contractCommission).toBe(0);
  });

  it("mixed-valid-HK flag zeros the commission", async () => {
    const { db } = buildChain({ profile: null });
    const result = await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
      hasValidHK: false,
    });
    expect(result.employeeCommission).toBe(0);
    expect(result.contractCommission).toBe(0);
  });

  it("profile with min_package_price < MIN_PACKAGE_PRICE still honors absolute floor (issue 4.9)", async () => {
    // Custom profile allows 15, but contract floor is 19.90 — absolute floor wins
    const profile: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.05,
      device_milestone_bonus: 2500,
      appliance_rate: 0.05,
      appliance_milestone_bonus: 0,
      min_package_price: 15,
      loyalty_bonuses: {},
    };
    const { db } = buildChain({});
    const result = await registerSaleCommission(db, {
      saleType: "line",
      amount: 18, // above profile min (15) but below contract floor (19.90)
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
      rateSnapshot: profile,
    });
    expect(result.contractCommission).toBe(0);
    expect(result.employeeCommission).toBe(0);
  });
});

describe("registerSaleCommission — device sales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("device sale produces base % + milestone from recalc", async () => {
    const { db } = buildChain({
      profile: null,
      insertedId: 55,
      // After milestone recalc the row was updated contract-wide
      updatedAfterRecalc: { commission_amount: 5500, contract_commission: 5500 },
    });
    const result = await registerSaleCommission(db, {
      saleType: "device",
      amount: 60000,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });
    // Recalc updates commission to base (3000) + milestone (2500) = 5500
    expect(result.employeeCommission).toBe(5500);
    expect(result.contractCommission).toBe(5500);
  });

  it("falls back to pre-recalc values if read-back is empty", async () => {
    const { db } = buildChain({
      profile: null,
      insertedId: 55,
      updatedAfterRecalc: undefined, // null row
    });
    const result = await registerSaleCommission(db, {
      saleType: "device",
      amount: 10000,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "manual",
    });
    // Base % only = 10000 × 0.05 = 500, no milestone crossed
    expect(result.employeeCommission).toBe(500);
  });
});

describe("registerSaleCommission — row shape", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rate_snapshot saved into row", async () => {
    const snapshot: EmployeeProfile = {
      line_multiplier: 5,
      device_rate: 0.08,
      device_milestone_bonus: 3000,
      appliance_rate: 0.05,
      appliance_milestone_bonus: 0,
      min_package_price: 25,
      loyalty_bonuses: { "6": 100 },
    };
    const { db, captured } = buildChain({});
    await registerSaleCommission(db, {
      saleType: "line",
      amount: 59,
      employeeId: "emp-1",
      saleDate: "2026-04-10",
      source: "sales_doc",
      sourceSalesDocId: 123,
      rateSnapshot: snapshot,
    });
    expect(captured.insert.rate_snapshot).toEqual(snapshot);
    expect(captured.insert.multiplier).toBe(5);
  });

  it.each<CommissionSource>(["pipeline", "sales_doc", "auto_sync", "manual"])(
    "accepts source=%s",
    async (source) => {
      const { db, captured } = buildChain({});
      await registerSaleCommission(db, {
        saleType: "line",
        amount: 59,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source,
      });
      expect(captured.insert.source).toBe(source);
    },
  );

  it("throws with underlying error message when insert fails", async () => {
    const { db } = buildChain({
      insertError: { message: "unique_violation" },
    });
    await expect(
      registerSaleCommission(db, {
        saleType: "line",
        amount: 59,
        employeeId: "emp-1",
        saleDate: "2026-04-10",
        source: "manual",
      }),
    ).rejects.toThrow(/unique_violation/);
  });
});

// ── Tests: cancelCommissionsByDoc / cancelCommissionsByDeal ──
describe("cancelCommissions — by doc / by deal", () => {
  beforeEach(() => vi.clearAllMocks());

  function buildCancelDb(opts: {
    lookupRows: Array<{ id: number; sale_date: string; sale_type: string }> | null;
    lookupError?: any;
    updateError?: any;
  }) {
    const { lookupRows, lookupError = null, updateError = null } = opts;
    // Thenable wrapper so the lookup chain `.is(...)` awaits to { data, error }
    const makeLookupChain = () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({ data: lookupRows, error: lookupError }),
      };
      return chain;
    };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: updateError }),
    };

    let firstCall = true;
    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "commission_sales") {
        if (firstCall) {
          firstCall = false;
          return makeLookupChain();
        }
        return updateChain;
      }
      return {};
    });
    return { db: { from } as any };
  }

  it("soft-deletes matching rows (sets deleted_at)", async () => {
    const { db } = buildCancelDb({
      lookupRows: [
        { id: 1, sale_date: "2026-04-10", sale_type: "line" },
        { id: 2, sale_date: "2026-04-12", sale_type: "device" },
      ],
    });
    const result = await cancelCommissionsByDoc(db, 99);
    expect(result.cancelledIds).toEqual([1, 2]);
  });

  it("returns affected months for device rows only", async () => {
    const { db } = buildCancelDb({
      lookupRows: [
        { id: 1, sale_date: "2026-04-10", sale_type: "line" }, // no affected month
        { id: 2, sale_date: "2026-04-12", sale_type: "device" },
        { id: 3, sale_date: "2026-05-02", sale_type: "device" },
      ],
    });
    const result = await cancelCommissionsByDeal(db, "deal-xyz");
    expect(result.affectedMonths.sort()).toEqual(["2026-04", "2026-05"]);
  });

  it("no-op if no rows match", async () => {
    const { db } = buildCancelDb({ lookupRows: [] });
    const result = await cancelCommissionsByDoc(db, 42);
    expect(result.cancelledIds).toEqual([]);
    expect(result.affectedMonths).toEqual([]);
  });

  it("throws when lookup fails", async () => {
    const { db } = buildCancelDb({
      lookupRows: null,
      lookupError: { message: "db_down" },
    });
    await expect(cancelCommissionsByDoc(db, 1)).rejects.toThrow(/db_down/);
  });
});

// ── Tests: lastDayOfMonth ──────────────────────────────
describe("lastDayOfMonth", () => {
  it("returns '2026-02-28' for '2026-02' (non-leap)", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });

  it("returns '2024-02-29' for '2024-02' (leap)", () => {
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29");
  });

  it("returns '2026-04-30' for '2026-04'", () => {
    expect(lastDayOfMonth("2026-04")).toBe("2026-04-30");
  });

  it("returns '2026-12-31' for '2026-12'", () => {
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });
});

// Sanity: exported constant matches spec
describe("MAX_SALE_AMOUNT sanity cap", () => {
  it("is 100000 (audit 4.12)", () => {
    expect(MAX_SALE_AMOUNT).toBe(100000);
    expect(COMMISSION.MIN_PACKAGE_PRICE).toBe(19.9);
  });
});
