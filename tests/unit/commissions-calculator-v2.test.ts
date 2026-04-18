/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Phase 10: post-refactor coverage for the commission calculator and ledger.
 *
 * - calcDualCommission now enforces the absolute MIN_PACKAGE_PRICE floor even
 *   when a profile carries a lower min (audit issue 4.9).
 * - allocateDeviceCommissionRows computes milestone bonuses on the
 *   contract-wide cumulative total (decision 4) and respects rate_snapshot
 *   (decision 7).
 */
import { describe, it, expect } from "vitest";
import {
  calcDualCommission,
  COMMISSION,
  type EmployeeProfile,
} from "@/lib/commissions/calculator";
import { allocateDeviceCommissionRows } from "@/lib/commissions/ledger";

// ── calcDualCommission: absolute floor + profile multipliers ──────────
describe("calcDualCommission — absolute MIN_PACKAGE_PRICE floor (issue 4.9)", () => {
  it("profile min 15, value 18 → both contract and employee zero", () => {
    // Profile says 15 is fine, but contract floor (19.90) overrides
    const profile: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.05,
      device_milestone_bonus: 2500,
      min_package_price: 15,
      loyalty_bonuses: {},
    };
    const result = calcDualCommission("line", 18, true, profile);
    expect(result.contractCommission).toBe(0);
    expect(result.employeeCommission).toBe(0);
  });

  it("profile min 25, value 20 → both zero (profile floor higher)", () => {
    const profile: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.05,
      device_milestone_bonus: 2500,
      min_package_price: 25,
      loyalty_bonuses: {},
    };
    const result = calcDualCommission("line", 20, true, profile);
    expect(result.contractCommission).toBe(0);
    expect(result.employeeCommission).toBe(0);
  });

  it("profile min 15 with custom multiplier → contract uses LINE_MULTIPLIER, employee uses profile multiplier", () => {
    const profile: EmployeeProfile = {
      line_multiplier: 5, // custom
      device_rate: 0.05,
      device_milestone_bonus: 2500,
      min_package_price: 15,
      loyalty_bonuses: {},
    };
    const result = calcDualCommission("line", 25, true, profile);
    expect(result.contractCommission).toBe(25 * COMMISSION.LINE_MULTIPLIER); // 100
    expect(result.employeeCommission).toBe(25 * 5); // 125
  });

  it("exact contract floor (19.90) passes", () => {
    const profile: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.05,
      device_milestone_bonus: 2500,
      min_package_price: 15,
      loyalty_bonuses: {},
    };
    const result = calcDualCommission("line", 19.9, true, profile);
    expect(result.contractCommission).toBeCloseTo(79.6, 2);
    expect(result.employeeCommission).toBeCloseTo(79.6, 2);
  });
});

describe("calcDualCommission — device sales (base % only, milestone comes later)", () => {
  it("device single sale: returns only base % (no milestone)", () => {
    // Even at 50k the calculator gives base only; ledger adds milestone
    const result = calcDualCommission("device", 50000, true, null);
    expect(result.contractCommission).toBe(50000 * COMMISSION.DEVICE_RATE); // 2500
    expect(result.employeeCommission).toBe(50000 * COMMISSION.DEVICE_RATE);
  });

  it("device with profile device_rate 0.08 → employee > contract", () => {
    const profile: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.08,
      device_milestone_bonus: 3000,
      min_package_price: 19.9,
      loyalty_bonuses: {},
    };
    const result = calcDualCommission("device", 10000, true, profile);
    expect(result.contractCommission).toBe(10000 * COMMISSION.DEVICE_RATE); // 500
    expect(result.employeeCommission).toBe(10000 * 0.08); // 800
    expect(result.employeeCommission).toBeGreaterThan(result.contractCommission);
  });
});

// ── allocateDeviceCommissionRows (contract-wide milestone, rate_snapshot) ──
describe("allocateDeviceCommissionRows — contract-wide milestone (decision 4)", () => {
  it("1 device sale of 60k: contract=3000+2500=5500, employee=3000+2500=5500", () => {
    const allocations = allocateDeviceCommissionRows([
      { id: 1, sale_date: "2026-04-01", device_sale_amount: 60000, employee_id: "emp-1" },
    ]);
    expect(allocations.get(1)).toEqual({
      contract_commission: 60000 * COMMISSION.DEVICE_RATE + COMMISSION.DEVICE_MILESTONE_BONUS,
      commission_amount: 60000 * COMMISSION.DEVICE_RATE + COMMISSION.DEVICE_MILESTONE_BONUS,
    });
  });

  it("2 sales 50k+20k: second crosses threshold → gets 2500 bonus", () => {
    const allocations = allocateDeviceCommissionRows([
      { id: 1, sale_date: "2026-04-01", device_sale_amount: 50000, employee_id: "emp-1" },
      { id: 2, sale_date: "2026-04-10", device_sale_amount: 20000, employee_id: "emp-1" },
    ]);
    // Row 1: 0→50000, crosses exactly one milestone at the boundary
    // Row 2: 50000→70000, no new milestone crossed
    // But note: running total after row1 = 50000, so floor(50000/50000)=1 already
    const row1 = allocations.get(1)!;
    const row2 = allocations.get(2)!;
    // Total bonus across both rows must equal 2500 (one milestone crossed)
    const totalBonus =
      row1.contract_commission - 50000 * COMMISSION.DEVICE_RATE +
      row2.contract_commission - 20000 * COMMISSION.DEVICE_RATE;
    expect(totalBonus).toBe(COMMISSION.DEVICE_MILESTONE_BONUS);
  });

  it("3 employees each selling 20k (60k total): 3rd crosses threshold → gets milestone", () => {
    const allocations = allocateDeviceCommissionRows([
      { id: 1, sale_date: "2026-04-01", device_sale_amount: 20000, employee_id: "emp-a" },
      { id: 2, sale_date: "2026-04-02", device_sale_amount: 20000, employee_id: "emp-b" },
      { id: 3, sale_date: "2026-04-03", device_sale_amount: 20000, employee_id: "emp-c" },
    ]);
    // 0→20k: no milestone
    expect(allocations.get(1)!.contract_commission).toBe(20000 * COMMISSION.DEVICE_RATE);
    // 20→40k: no milestone
    expect(allocations.get(2)!.contract_commission).toBe(20000 * COMMISSION.DEVICE_RATE);
    // 40→60k: crosses 50k, gets milestone bonus
    expect(allocations.get(3)!.contract_commission).toBe(
      20000 * COMMISSION.DEVICE_RATE + COMMISSION.DEVICE_MILESTONE_BONUS,
    );
    // Matching employee commission for emp-c with default profile
    expect(allocations.get(3)!.commission_amount).toBe(
      20000 * COMMISSION.DEVICE_RATE + COMMISSION.DEVICE_MILESTONE_BONUS,
    );
  });

  it("custom profile (device_rate 0.08, device_milestone_bonus 3000): employee base uses profile rate but milestone is contract (2500) per decision 4", () => {
    const profile: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.08,
      device_milestone_bonus: 3000, // profile bonus NOT used — contract bonus wins
      min_package_price: 19.9,
      loyalty_bonuses: {},
    };
    const profileMap = new Map<string, EmployeeProfile | null>([["emp-1", profile]]);
    const allocations = allocateDeviceCommissionRows(
      [{ id: 1, sale_date: "2026-04-01", device_sale_amount: 60000, employee_id: "emp-1" }],
      profileMap,
    );
    const row = allocations.get(1)!;
    // Employee base = 60000 × 0.08 = 4800; milestone is contract-wide 2500
    expect(row.commission_amount).toBe(60000 * 0.08 + COMMISSION.DEVICE_MILESTONE_BONUS);
    // Contract commission reference = 60000 × 0.05 + 2500 = 5500
    expect(row.contract_commission).toBe(
      60000 * COMMISSION.DEVICE_RATE + COMMISSION.DEVICE_MILESTONE_BONUS,
    );
  });

  it("rate_snapshot on a row: used instead of current profile (immutability — decision 7)", () => {
    // Frozen snapshot pays 0.10 rate even though current profile is 0.03
    const frozen: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.1,
      device_milestone_bonus: 2500,
      min_package_price: 19.9,
      loyalty_bonuses: {},
    };
    const current: EmployeeProfile = {
      line_multiplier: 4,
      device_rate: 0.03,
      device_milestone_bonus: 2500,
      min_package_price: 19.9,
      loyalty_bonuses: {},
    };
    const profileMap = new Map<string, EmployeeProfile | null>([["emp-1", current]]);
    const allocations = allocateDeviceCommissionRows(
      [
        {
          id: 1,
          sale_date: "2026-04-01",
          device_sale_amount: 10000,
          employee_id: "emp-1",
          rate_snapshot: frozen,
        },
      ],
      profileMap,
    );
    // Should use 0.10 (frozen), not 0.03 (current)
    expect(allocations.get(1)!.commission_amount).toBe(10000 * 0.1);
  });

  it("row with no employee_id falls back to DEFAULT_EMPLOYEE_PROFILE", () => {
    const allocations = allocateDeviceCommissionRows([
      { id: 1, sale_date: "2026-04-01", device_sale_amount: 10000, employee_id: null },
    ]);
    expect(allocations.get(1)!.commission_amount).toBe(10000 * COMMISSION.DEVICE_RATE);
  });

  it("sort order uses sale_date then id for deterministic milestone attribution", () => {
    // Later-dated row goes second; earlier id ties go first when same date
    const allocations = allocateDeviceCommissionRows([
      { id: 2, sale_date: "2026-04-10", device_sale_amount: 30000, employee_id: "emp-1" },
      { id: 1, sale_date: "2026-04-01", device_sale_amount: 30000, employee_id: "emp-1" },
    ]);
    // After id=1 (0→30k) no milestone; after id=2 (30→60k) one crosses
    expect(allocations.get(1)!.contract_commission).toBe(30000 * COMMISSION.DEVICE_RATE);
    expect(allocations.get(2)!.contract_commission).toBe(
      30000 * COMMISSION.DEVICE_RATE + COMMISSION.DEVICE_MILESTONE_BONUS,
    );
  });
});
