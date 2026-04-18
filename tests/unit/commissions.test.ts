import { describe, expect, it } from "vitest";
import { calcMonthlySummary, type EmployeeProfile } from "@/lib/commissions/calculator";
import { buildAutoSyncCommissionIdentity } from "@/lib/commissions/sync-orders";
import {
  allocateDeviceCommissionRows,
  resolveCommissionSaleDate,
  summarizeOrderDevices,
} from "@/lib/commissions/ledger";

describe("Commission Helpers", () => {
  it("summarizes device-only value from mixed order items", () => {
    const summary = summarizeOrderDevices([
      {
        order_id: "CLM-1",
        product_name: "iPhone 16 Pro",
        product_type: "device",
        price: 4200,
        quantity: 2,
      },
      {
        order_id: "CLM-1",
        product_name: "Case",
        product_type: "accessory",
        price: 100,
        quantity: 3,
      },
      {
        order_id: "CLM-1",
        product_name: "Galaxy S24",
        product_type: "device",
        price: 3200,
        quantity: 1,
      },
    ]);

    expect(summary.hasDevice).toBe(true);
    expect(summary.deviceSaleAmount).toBe(11600);
    expect(summary.deviceName).toBe("iPhone 16 Pro +1");
    expect(summary.deviceItems).toHaveLength(2);
  });

  it("uses the earliest commissionable status date for order-driven commissions", () => {
    const saleDate = resolveCommissionSaleDate("2026-04-01T08:00:00.000Z", [
      { order_id: "CLM-1", new_status: "new", created_at: "2026-04-01T09:00:00.000Z" },
      { order_id: "CLM-1", new_status: "shipped", created_at: "2026-04-05T12:00:00.000Z" },
      { order_id: "CLM-1", new_status: "approved", created_at: "2026-04-03T10:00:00.000Z" },
    ]);

    expect(saleDate).toBe("2026-04-03");
  });

  it("falls back to order creation date when no commissionable status exists", () => {
    const saleDate = resolveCommissionSaleDate("2026-04-01T08:00:00.000Z", [
      { order_id: "CLM-1", new_status: "new", created_at: "2026-04-01T09:00:00.000Z" },
      { order_id: "CLM-1", new_status: "processing", created_at: "2026-04-02T10:00:00.000Z" },
    ]);

    expect(saleDate).toBe("2026-04-01");
  });

  // Updated 2026-04-18: commission refactor — milestone bonus is contract-wide
  // (decision 4). Employee base % uses profile rate (0.03), but milestone bonus
  // uses contract's 2500, not profile's 1000.
  it("allocates device milestone bonuses per month for contract and employee profile", () => {
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
      profileMap,
    );

    // Row 1: 40000 * 0.03 = 1200, no milestone crossed
    expect(allocations.get(1)).toEqual({
      contract_commission: 2000,
      commission_amount: 1200,
    });
    // Row 2: 15000 * 0.03 = 450 + contract-wide milestone 2500 (55000 > 50000) = 2950
    expect(allocations.get(2)).toEqual({
      contract_commission: 3250,
      commission_amount: 2950,
    });
  });

  it("builds monthly summaries from persisted ledger values", () => {
    const summary = calcMonthlySummary(
      [
        { sale_type: "line", commission_amount: 120, source: "manual" },
        { sale_type: "device", commission_amount: 999, source: "auto_sync", device_sale_amount: 50000 },
        { sale_type: "device", commission_amount: 250, source: "csv_import", device_sale_amount: 10000 },
      ],
      [{ amount: 70 }],
      30,
      { target_total: 2000 },
    );

    expect(summary.linesCommission).toBe(120);
    expect(summary.devicesCommission).toBe(1249);
    expect(summary.netCommission).toBe(1329);
    expect(summary.autoSyncedCount).toBe(1);
    expect(summary.manualEntryCount).toBe(2);
  });

  it("builds enriched identity fields for auto-synced commissions", () => {
    const identity = buildAutoSyncCommissionIdentity("cust-1", {
      customerCodeMap: new Map([["cust-1", "CLAL-000123"]]),
      primaryHotMap: new Map([["cust-1", { id: "hot-1", hot_mobile_id: "HOT-7788" }]]),
    });

    expect(identity).toEqual({
      customer_id: "cust-1",
      customer_hot_account_id: "hot-1",
      hot_mobile_id_snapshot: "HOT-7788",
      store_customer_code_snapshot: "CLAL-000123",
      match_status: "matched",
      match_method: "order_sync",
      match_confidence: 1.0,
    });
  });

  it("marks auto-synced commissions as unmatched when no customer is linked", () => {
    const identity = buildAutoSyncCommissionIdentity(null, {
      customerCodeMap: new Map(),
      primaryHotMap: new Map(),
    });

    expect(identity).toEqual({
      customer_id: null,
      customer_hot_account_id: null,
      hot_mobile_id_snapshot: null,
      store_customer_code_snapshot: null,
      match_status: "unmatched",
      match_method: null,
      match_confidence: null,
    });
  });
});
