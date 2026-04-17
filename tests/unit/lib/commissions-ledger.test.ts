import { describe, it, expect } from "vitest";
import {
  summarizeOrderDevices,
  resolveCommissionSaleDate,
  isCommissionableOrderStatus,
  getCommissionTargetKey,
  getCommissionTargetKeys,
  sortBySaleDateAndId,
  allocateDeviceCommissionRows,
  COMMISSIONABLE_STATUSES,
  COMMISSION_CONTRACT_TARGET_KEY,
} from "@/lib/commissions/ledger";
import type { EmployeeProfile } from "@/lib/commissions/calculator";

// ─── summarizeOrderDevices ────────────────────────────────────────

describe("summarizeOrderDevices", () => {
  it("sums only device items by price * quantity", () => {
    const result = summarizeOrderDevices([
      { order_id: "CLM-1", product_name: "iPhone 16", product_type: "device", price: 4000, quantity: 2 },
      { order_id: "CLM-1", product_name: "Case", product_type: "accessory", price: 100, quantity: 3 },
    ]);
    expect(result.deviceSaleAmount).toBe(8000);
    expect(result.hasDevice).toBe(true);
    expect(result.deviceItems).toHaveLength(1);
  });

  it("builds deviceName from single device", () => {
    const result = summarizeOrderDevices([
      { order_id: "CLM-1", product_name: "Galaxy S25", product_type: "device", price: 3500, quantity: 1 },
    ]);
    expect(result.deviceName).toBe("Galaxy S25");
  });

  it("builds deviceName from multiple devices with +N suffix", () => {
    const result = summarizeOrderDevices([
      { order_id: "CLM-1", product_name: "iPhone 16", product_type: "device", price: 4000, quantity: 1 },
      { order_id: "CLM-1", product_name: "Galaxy S25", product_type: "device", price: 3500, quantity: 1 },
      { order_id: "CLM-1", product_name: "Xiaomi 15", product_type: "device", price: 2500, quantity: 1 },
    ]);
    expect(result.deviceName).toBe("iPhone 16 +2");
  });

  it("returns null deviceName when no devices exist", () => {
    const result = summarizeOrderDevices([
      { order_id: "CLM-1", product_name: "Case", product_type: "accessory", price: 50, quantity: 1 },
    ]);
    expect(result.deviceName).toBeNull();
    expect(result.hasDevice).toBe(false);
    expect(result.deviceSaleAmount).toBe(0);
  });

  it("handles empty items array", () => {
    const result = summarizeOrderDevices([]);
    expect(result.hasDevice).toBe(false);
    expect(result.deviceSaleAmount).toBe(0);
    expect(result.deviceName).toBeNull();
    expect(result.deviceItems).toHaveLength(0);
  });

  it("handles null or undefined prices gracefully", () => {
    const result = summarizeOrderDevices([
      { order_id: "CLM-1", product_name: "Phone", product_type: "device", price: null, quantity: 1 },
    ]);
    expect(result.deviceSaleAmount).toBe(0);
    expect(result.hasDevice).toBe(false);
  });

  it("handles string prices and quantities", () => {
    const result = summarizeOrderDevices([
      { order_id: "CLM-1", product_name: "Phone", product_type: "device", price: "3000" as any, quantity: "2" as any },
    ]);
    expect(result.deviceSaleAmount).toBe(6000);
    expect(result.hasDevice).toBe(true);
  });
});

// ─── resolveCommissionSaleDate ────────────────────────────────────

describe("resolveCommissionSaleDate", () => {
  it("returns the earliest commissionable status date", () => {
    const date = resolveCommissionSaleDate("2026-04-01T08:00:00.000Z", [
      { order_id: "CLM-1", new_status: "new", created_at: "2026-04-01T09:00:00.000Z" },
      { order_id: "CLM-1", new_status: "shipped", created_at: "2026-04-05T12:00:00.000Z" },
      { order_id: "CLM-1", new_status: "approved", created_at: "2026-04-03T10:00:00.000Z" },
    ]);
    expect(date).toBe("2026-04-03");
  });

  it("falls back to order creation date when no commissionable status exists", () => {
    const date = resolveCommissionSaleDate("2026-04-01T08:00:00.000Z", [
      { order_id: "CLM-1", new_status: "new", created_at: "2026-04-01T09:00:00.000Z" },
      { order_id: "CLM-1", new_status: "processing", created_at: "2026-04-02T10:00:00.000Z" },
    ]);
    expect(date).toBe("2026-04-01");
  });

  it("falls back to order creation date when history is empty", () => {
    const date = resolveCommissionSaleDate("2026-04-15T14:30:00.000Z", []);
    expect(date).toBe("2026-04-15");
  });

  it("handles delivered as a commissionable status", () => {
    const date = resolveCommissionSaleDate("2026-04-01T00:00:00.000Z", [
      { order_id: "CLM-1", new_status: "delivered", created_at: "2026-04-10T12:00:00.000Z" },
    ]);
    expect(date).toBe("2026-04-10");
  });
});

// ─── isCommissionableOrderStatus ──────────────────────────────────

describe("isCommissionableOrderStatus", () => {
  it("returns true for approved, shipped, delivered", () => {
    expect(isCommissionableOrderStatus("approved")).toBe(true);
    expect(isCommissionableOrderStatus("shipped")).toBe(true);
    expect(isCommissionableOrderStatus("delivered")).toBe(true);
  });

  it("returns false for non-commissionable statuses", () => {
    expect(isCommissionableOrderStatus("new")).toBe(false);
    expect(isCommissionableOrderStatus("pending")).toBe(false);
    expect(isCommissionableOrderStatus("cancelled")).toBe(false);
    expect(isCommissionableOrderStatus("returned")).toBe(false);
    expect(isCommissionableOrderStatus("")).toBe(false);
  });
});

// ─── getCommissionTargetKey ───────────────────────────────────────

describe("getCommissionTargetKey", () => {
  it("returns targetKey when provided", () => {
    expect(getCommissionTargetKey({ targetKey: "tk-1" })).toBe("tk-1");
  });

  it("returns employeeKey when no targetKey", () => {
    expect(getCommissionTargetKey({ employeeKey: "ek-1" })).toBe("ek-1");
  });

  it("returns employeeId when no targetKey or employeeKey", () => {
    expect(getCommissionTargetKey({ employeeId: "eid-1" })).toBe("eid-1");
  });

  it("returns COMMISSION_CONTRACT_TARGET_KEY when nothing is provided", () => {
    expect(getCommissionTargetKey()).toBe(COMMISSION_CONTRACT_TARGET_KEY);
    expect(getCommissionTargetKey({})).toBe(COMMISSION_CONTRACT_TARGET_KEY);
  });

  it("prioritizes targetKey over others", () => {
    expect(
      getCommissionTargetKey({ targetKey: "tk", employeeKey: "ek", employeeId: "eid" })
    ).toBe("tk");
  });
});

// ─── getCommissionTargetKeys ──────────────────────────────────────

describe("getCommissionTargetKeys", () => {
  it("returns deduplicated list of keys", () => {
    const keys = getCommissionTargetKeys({
      targetKey: "tk-1",
      employeeKey: "ek-1",
      employeeId: "eid-1",
      employeeName: "Sami",
    });
    expect(keys).toContain("tk-1");
    expect(keys).toContain("ek-1");
    expect(keys).toContain("eid-1");
    expect(keys).toContain("Sami");
    // unique entries only
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns only the fallback key when nothing is provided", () => {
    const keys = getCommissionTargetKeys();
    expect(keys).toEqual([COMMISSION_CONTRACT_TARGET_KEY]);
  });

  it("deduplicates when targetKey and employeeKey are the same", () => {
    const keys = getCommissionTargetKeys({
      targetKey: "same-id",
      employeeKey: "same-id",
      employeeId: "same-id",
    });
    expect(keys).toEqual(["same-id"]);
  });

  it("filters out null/undefined values", () => {
    const keys = getCommissionTargetKeys({
      targetKey: null,
      employeeKey: null,
      employeeId: "eid-1",
    });
    expect(keys).toContain("eid-1");
    expect(keys.every((k) => k !== null && k !== undefined)).toBe(true);
  });
});

// ─── sortBySaleDateAndId ──────────────────────────────────────────

describe("sortBySaleDateAndId", () => {
  it("sorts by sale_date then by id", () => {
    const rows = [
      { id: 3, sale_date: "2026-04-02" },
      { id: 1, sale_date: "2026-04-01" },
      { id: 2, sale_date: "2026-04-01" },
    ];
    const sorted = sortBySaleDateAndId(rows);
    expect(sorted.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("handles string ids with numeric sorting", () => {
    const rows = [
      { id: "10", sale_date: "2026-04-01" },
      { id: "2", sale_date: "2026-04-01" },
      { id: "1", sale_date: "2026-04-01" },
    ];
    const sorted = sortBySaleDateAndId(rows);
    expect(sorted.map((r) => r.id)).toEqual(["1", "2", "10"]);
  });

  it("does not mutate the original array", () => {
    const rows = [
      { id: 2, sale_date: "2026-04-02" },
      { id: 1, sale_date: "2026-04-01" },
    ];
    const original = [...rows];
    sortBySaleDateAndId(rows);
    expect(rows).toEqual(original);
  });

  it("handles empty array", () => {
    expect(sortBySaleDateAndId([])).toEqual([]);
  });
});

// ─── allocateDeviceCommissionRows ─────────────────────────────────

describe("allocateDeviceCommissionRows", () => {
  it("allocates contract commission with milestone bonus", () => {
    const allocations = allocateDeviceCommissionRows([
      { id: 1, sale_date: "2026-04-01", device_sale_amount: 40000, employee_id: null },
      { id: 2, sale_date: "2026-04-10", device_sale_amount: 15000, employee_id: null },
    ]);
    // row 1: 40000 * 0.05 = 2000, 0 milestones crossed
    expect(allocations.get(1)!.contract_commission).toBe(2000);
    // row 2: 15000 * 0.05 = 750 + 1 milestone (55000 > 50000) = 750 + 2500 = 3250
    expect(allocations.get(2)!.contract_commission).toBe(3250);
  });

  it("applies employee profile for employee-specific rows", () => {
    const profileMap = new Map<string, EmployeeProfile | null>([
      [
        "emp-1",
        {
          line_multiplier: 4,
          device_rate: 0.03,
          device_milestone_bonus: 1000,
          min_package_price: 19.9,
          loyalty_bonuses: {},
        },
      ],
    ]);

    const allocations = allocateDeviceCommissionRows(
      [
        { id: 1, sale_date: "2026-04-01", device_sale_amount: 40000, employee_id: "emp-1" },
        { id: 2, sale_date: "2026-04-10", device_sale_amount: 15000, employee_id: "emp-1" },
      ],
      profileMap
    );

    // Employee row 1: 40000 * 0.03 = 1200, 0 milestones
    expect(allocations.get(1)!.commission_amount).toBe(1200);
    // Employee row 2: 15000 * 0.03 = 450 + 1 milestone (55000 > 50000) * 1000 = 1450
    expect(allocations.get(2)!.commission_amount).toBe(1450);
    // Contract commission still uses standard rates
    expect(allocations.get(1)!.contract_commission).toBe(2000);
    expect(allocations.get(2)!.contract_commission).toBe(3250);
  });

  it("uses DEFAULT_EMPLOYEE_PROFILE when employee has no profile in map", () => {
    const allocations = allocateDeviceCommissionRows(
      [{ id: 1, sale_date: "2026-04-01", device_sale_amount: 10000, employee_id: "emp-unknown" }],
      new Map()
    );
    // Default device_rate is 0.05, same as contract
    expect(allocations.get(1)!.commission_amount).toBe(500);
    expect(allocations.get(1)!.contract_commission).toBe(500);
  });

  it("handles empty rows array", () => {
    const allocations = allocateDeviceCommissionRows([]);
    expect(allocations.size).toBe(0);
  });

  it("handles mixed employee and non-employee rows", () => {
    const profileMap = new Map<string, EmployeeProfile | null>([
      [
        "emp-1",
        {
          line_multiplier: 4,
          device_rate: 0.10,
          device_milestone_bonus: 5000,
          min_package_price: 19.9,
          loyalty_bonuses: {},
        },
      ],
    ]);

    const allocations = allocateDeviceCommissionRows(
      [
        { id: 1, sale_date: "2026-04-01", device_sale_amount: 20000, employee_id: null },
        { id: 2, sale_date: "2026-04-02", device_sale_amount: 30000, employee_id: "emp-1" },
      ],
      profileMap
    );

    // Row 1: no employee, contract commission = 20000 * 0.05 = 1000
    expect(allocations.get(1)!.contract_commission).toBe(1000);
    // commission_amount should equal contract_commission for non-employee rows
    expect(allocations.get(1)!.commission_amount).toBe(1000);

    // Row 2 employee: 30000 * 0.10 = 3000, 0 employee milestones (only 30000 for this employee)
    expect(allocations.get(2)!.commission_amount).toBe(3000);
    // Row 2 contract: 30000 * 0.05 = 1500 + milestone bonus (50000 crossed) = 1500 + 2500 = 4000
    expect(allocations.get(2)!.contract_commission).toBe(4000);
  });
});
