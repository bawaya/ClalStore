import { describe, it, expect } from "vitest";
import {
  COMMISSION,
  calcLineCommission,
  calcDeviceCommission,
  calcLoyaltyBonus,
  calcRequiredForTarget,
  calcMonthlySummary,
  calcDualCommission,
  calcEmployeeLineCommission,
  calcEmployeeDeviceCommission,
  DEFAULT_EMPLOYEE_PROFILE,
  type EmployeeProfile,
} from "@/lib/commissions/calculator";

// ─── calcLineCommission ───────────────────────────────────────────

describe("calcLineCommission", () => {
  it("returns packagePrice * 4 when HK is valid and price >= MIN", () => {
    expect(calcLineCommission(25, true)).toBe(100);
    expect(calcLineCommission(59, true)).toBe(236);
  });

  it("returns 0 when hasValidHK is false", () => {
    expect(calcLineCommission(59, false)).toBe(0);
    expect(calcLineCommission(100, false)).toBe(0);
  });

  it("returns 0 when package price is below MIN_PACKAGE_PRICE", () => {
    expect(calcLineCommission(10, true)).toBe(0);
    expect(calcLineCommission(19, true)).toBe(0);
    expect(calcLineCommission(19.89, true)).toBe(0);
  });

  it("returns commission at exactly MIN_PACKAGE_PRICE", () => {
    expect(calcLineCommission(COMMISSION.MIN_PACKAGE_PRICE, true)).toBe(
      COMMISSION.MIN_PACKAGE_PRICE * COMMISSION.LINE_MULTIPLIER
    );
  });

  it("returns 0 when price is 0", () => {
    expect(calcLineCommission(0, true)).toBe(0);
  });
});

// ─── calcDeviceCommission ─────────────────────────────────────────

describe("calcDeviceCommission", () => {
  it("returns 5% base with no milestones for small sales", () => {
    const result = calcDeviceCommission(10000);
    expect(result.basePct).toBe(500);
    expect(result.milestoneCount).toBe(0);
    expect(result.milestoneBonus).toBe(0);
    expect(result.total).toBe(500);
  });

  it("grants one milestone bonus at 50000", () => {
    const result = calcDeviceCommission(50000);
    expect(result.basePct).toBe(2500);
    expect(result.milestoneCount).toBe(1);
    expect(result.milestoneBonus).toBe(2500);
    expect(result.total).toBe(5000);
  });

  it("grants two milestone bonuses at 100000", () => {
    const result = calcDeviceCommission(100000);
    expect(result.milestoneCount).toBe(2);
    expect(result.milestoneBonus).toBe(5000);
    expect(result.total).toBe(10000);
  });

  it("calculates next milestone progress correctly", () => {
    const result = calcDeviceCommission(30000);
    expect(result.nextMilestoneAt).toBe(20000);
    expect(result.nextMilestoneProgress).toBe(60);
  });

  it("shows 0 progress at exact milestone boundary", () => {
    const result = calcDeviceCommission(50000);
    expect(result.nextMilestoneAt).toBe(50000);
    expect(result.nextMilestoneProgress).toBe(0);
  });

  it("handles zero sales", () => {
    const result = calcDeviceCommission(0);
    expect(result.basePct).toBe(0);
    expect(result.milestoneCount).toBe(0);
    expect(result.total).toBe(0);
    expect(result.nextMilestoneAt).toBe(50000);
    expect(result.nextMilestoneProgress).toBe(0);
  });
});

// ─── calcLoyaltyBonus ─────────────────────────────────────────────

describe("calcLoyaltyBonus", () => {
  it("returns 0 earned for a new line (0 months)", () => {
    const result = calcLoyaltyBonus("2026-04-01", "2026-04-01");
    expect(result.monthsActive).toBe(0);
    expect(result.earnedSoFar).toBe(0);
    expect(result.isInLoyaltyPeriod).toBe(true);
    expect(result.nextBonus).not.toBeNull();
    expect(result.nextBonus!.months).toBe(5);
  });

  it("earns 80 ILS at 5 months", () => {
    const result = calcLoyaltyBonus("2026-01-01", "2026-06-01");
    expect(result.monthsActive).toBe(5);
    expect(result.earnedSoFar).toBe(80);
    expect(result.nextBonus!.months).toBe(9);
  });

  it("earns 80 + 30 = 110 at 9 months", () => {
    const result = calcLoyaltyBonus("2025-07-01", "2026-04-01");
    expect(result.monthsActive).toBe(9);
    expect(result.earnedSoFar).toBe(110);
    expect(result.nextBonus!.months).toBe(12);
  });

  it("earns all bonuses (80 + 30 + 20 + 50 = 180) at 15+ months", () => {
    const result = calcLoyaltyBonus("2025-01-01", "2026-04-17");
    expect(result.monthsActive).toBeGreaterThanOrEqual(15);
    expect(result.earnedSoFar).toBe(180);
    expect(result.nextBonus).toBeNull();
  });

  it("marks loyalty period as expired after LOYALTY_PERIOD_DAYS", () => {
    // 150 days is the loyalty period
    const start = "2025-01-01";
    const farFuture = "2026-01-01";
    const result = calcLoyaltyBonus(start, farFuture);
    expect(result.isInLoyaltyPeriod).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it("calculates daysRemaining correctly within loyalty period", () => {
    const result = calcLoyaltyBonus("2026-04-01", "2026-04-11");
    expect(result.daysRemaining).toBe(140);
    expect(result.isInLoyaltyPeriod).toBe(true);
  });

  it("handles future start date (negative diff)", () => {
    const result = calcLoyaltyBonus("2026-12-01", "2026-04-01");
    expect(result.monthsActive).toBeLessThan(0);
    expect(result.earnedSoFar).toBe(0);
  });
});

// ─── calcRequiredForTarget ────────────────────────────────────────

describe("calcRequiredForTarget", () => {
  it("calculates remaining amount when no progress is provided", () => {
    const result = calcRequiredForTarget(5000, "2026-04-01", "2026-04-30");
    expect(result.remaining).toBe(5000);
    expect(result.totalDays).toBe(30);
  });

  it("subtracts current progress from target", () => {
    const result = calcRequiredForTarget(5000, "2026-04-01", "2026-04-30", {
      linesCommission: 1000,
      devicesCommission: 500,
      loyaltyBonus: 200,
      sanctions: 100,
    });
    // currentTotal = 1000 + 500 + 200 - 100 = 1600
    expect(result.remaining).toBe(3400);
  });

  it("remaining is 0 when progress exceeds target", () => {
    const result = calcRequiredForTarget(1000, "2026-04-01", "2026-04-30", {
      linesCommission: 800,
      devicesCommission: 500,
      loyaltyBonus: 0,
      sanctions: 0,
    });
    expect(result.remaining).toBe(0);
  });

  it("generates linesOnly scenario", () => {
    const result = calcRequiredForTarget(1000, "2026-04-01", "2026-04-30");
    // avgPackagePrice = 25, lineCommPerLine = 100
    expect(result.scenarios.linesOnly.count).toBe(10);
    expect(result.scenarios.linesOnly.packagePrice).toBe(25);
  });

  it("generates devicesOnly scenario", () => {
    const result = calcRequiredForTarget(1000, "2026-04-01", "2026-04-30");
    // deviceSalesNeeded = 1000 / 0.05 = 20000
    expect(result.scenarios.devicesOnly.salesNeeded).toBe(20000);
  });

  it("generates mixed scenario (60/40 split)", () => {
    const result = calcRequiredForTarget(10000, "2026-04-01", "2026-04-30");
    // mixedLinesTarget = 6000, mixedDevicesTarget = 4000
    // mixedLines = ceil(6000 / 100) = 60
    // mixedDeviceSales = 4000 / 0.05 = 80000
    expect(result.scenarios.mixed.lines).toBe(60);
    expect(result.scenarios.mixed.deviceSales).toBe(80000);
  });

  it("counts working days excluding Saturdays", () => {
    // April 2026: starts Wed, Saturdays are 4, 11, 18, 25
    // Total 30 days, 4 Saturdays = 26 working days
    const result = calcRequiredForTarget(1000, "2026-04-01", "2026-04-30");
    expect(result.workingDays).toBe(26);
  });
});

// ─── calcMonthlySummary ───────────────────────────────────────────

describe("calcMonthlySummary", () => {
  it("aggregates lines and devices commissions separately", () => {
    const result = calcMonthlySummary(
      [
        { sale_type: "line", commission_amount: 200, source: "manual" },
        { sale_type: "line", commission_amount: 300, source: "auto_sync" },
        { sale_type: "device", commission_amount: 500, source: "auto_sync", device_sale_amount: 10000 },
      ],
      [],
      0,
      null
    );
    expect(result.linesCommission).toBe(500);
    expect(result.devicesCommission).toBe(500);
    expect(result.grossCommission).toBe(1000);
  });

  it("subtracts sanctions from gross to get net", () => {
    const result = calcMonthlySummary(
      [{ sale_type: "line", commission_amount: 1000, source: "manual" }],
      [{ amount: 200 }, { amount: 50 }],
      100,
      null
    );
    expect(result.grossCommission).toBe(1100); // 1000 + 100 loyalty
    expect(result.totalSanctions).toBe(250);
    expect(result.netCommission).toBe(850);
  });

  it("includes loyalty bonuses in gross commission", () => {
    const result = calcMonthlySummary([], [], 500, null);
    expect(result.grossCommission).toBe(500);
    expect(result.loyaltyBonus).toBe(500);
  });

  it("calculates target progress as percentage capped at 100", () => {
    const result = calcMonthlySummary(
      [{ sale_type: "line", commission_amount: 2500, source: "manual" }],
      [],
      0,
      { target_total: 2000 }
    );
    expect(result.targetProgress).toBe(100);
  });

  it("returns 0 target progress when no target is set", () => {
    const result = calcMonthlySummary(
      [{ sale_type: "line", commission_amount: 100, source: "manual" }],
      [],
      0,
      null
    );
    expect(result.targetAmount).toBe(0);
    expect(result.targetProgress).toBe(0);
  });

  it("counts auto-synced and manual entries separately", () => {
    const result = calcMonthlySummary(
      [
        { sale_type: "line", commission_amount: 100, source: "auto_sync" },
        { sale_type: "line", commission_amount: 100, source: "auto_sync" },
        { sale_type: "line", commission_amount: 100, source: "manual" },
        { sale_type: "device", commission_amount: 200, source: "csv_import" },
      ],
      [],
      0,
      null
    );
    expect(result.autoSyncedCount).toBe(2);
    expect(result.manualEntryCount).toBe(2);
  });

  it("handles empty sales and sanctions", () => {
    const result = calcMonthlySummary([], [], 0, { target_total: 1000 });
    expect(result.linesCommission).toBe(0);
    expect(result.devicesCommission).toBe(0);
    expect(result.netCommission).toBe(0);
    expect(result.targetProgress).toBe(0);
  });
});

// ─── calcDualCommission ───────────────────────────────────────────

describe("calcDualCommission", () => {
  const customProfile: EmployeeProfile = {
    line_multiplier: 3,
    device_rate: 0.03,
    device_milestone_bonus: 1000,
    min_package_price: 29,
    loyalty_bonuses: {},
  };

  describe("line sales", () => {
    it("uses contract rate when no profile is provided", () => {
      const result = calcDualCommission("line", 50, true, null);
      expect(result.contractCommission).toBe(200); // 50 * 4
      expect(result.employeeCommission).toBe(200); // same as contract
    });

    it("uses employee multiplier when profile is provided", () => {
      const result = calcDualCommission("line", 50, true, customProfile);
      expect(result.contractCommission).toBe(200); // 50 * 4
      expect(result.employeeCommission).toBe(150); // 50 * 3
    });

    it("returns 0 contract commission when HK is invalid", () => {
      const result = calcDualCommission("line", 50, false, customProfile);
      expect(result.contractCommission).toBe(0);
      expect(result.employeeCommission).toBe(150); // employee is independent of HK in dual
    });

    it("returns 0 employee commission when below employee min_package_price", () => {
      const result = calcDualCommission("line", 20, true, customProfile);
      expect(result.contractCommission).toBe(80); // 20 * 4
      expect(result.employeeCommission).toBe(0); // 20 < 29
    });
  });

  describe("device sales", () => {
    it("uses contract rate when no profile is provided", () => {
      const result = calcDualCommission("device", 10000, true, null);
      expect(result.contractCommission).toBe(500); // 10000 * 0.05
      expect(result.employeeCommission).toBe(500);
    });

    it("uses employee rate when profile is provided", () => {
      const result = calcDualCommission("device", 10000, true, customProfile);
      expect(result.contractCommission).toBe(500); // 10000 * 0.05
      expect(result.employeeCommission).toBe(300); // 10000 * 0.03
    });
  });
});

// ─── calcEmployeeLineCommission ───────────────────────────────────

describe("calcEmployeeLineCommission", () => {
  it("returns packagePrice * employee multiplier when above min", () => {
    const profile: EmployeeProfile = {
      ...DEFAULT_EMPLOYEE_PROFILE,
      line_multiplier: 3,
      min_package_price: 25,
    };
    expect(calcEmployeeLineCommission(30, profile)).toBe(90);
  });

  it("returns 0 when below employee min_package_price", () => {
    const profile: EmployeeProfile = {
      ...DEFAULT_EMPLOYEE_PROFILE,
      min_package_price: 30,
    };
    expect(calcEmployeeLineCommission(25, profile)).toBe(0);
  });

  it("works at exactly min_package_price", () => {
    const profile: EmployeeProfile = {
      ...DEFAULT_EMPLOYEE_PROFILE,
      line_multiplier: 2,
      min_package_price: 20,
    };
    expect(calcEmployeeLineCommission(20, profile)).toBe(40);
  });
});

// ─── calcEmployeeDeviceCommission ─────────────────────────────────

describe("calcEmployeeDeviceCommission", () => {
  it("applies custom device_rate", () => {
    const profile: EmployeeProfile = {
      ...DEFAULT_EMPLOYEE_PROFILE,
      device_rate: 0.03,
      device_milestone_bonus: 1000,
    };
    const result = calcEmployeeDeviceCommission(20000, profile);
    expect(result.basePct).toBe(600); // 20000 * 0.03
    expect(result.milestoneCount).toBe(0);
    expect(result.total).toBe(600);
  });

  it("grants milestones using employee bonus rate", () => {
    const profile: EmployeeProfile = {
      ...DEFAULT_EMPLOYEE_PROFILE,
      device_rate: 0.03,
      device_milestone_bonus: 1000,
    };
    const result = calcEmployeeDeviceCommission(55000, profile);
    expect(result.basePct).toBe(1650); // 55000 * 0.03
    expect(result.milestoneCount).toBe(1);
    expect(result.milestoneBonus).toBe(1000);
    expect(result.total).toBe(2650);
  });

  it("returns 0 milestones when device_milestone_bonus is 0", () => {
    const profile: EmployeeProfile = {
      ...DEFAULT_EMPLOYEE_PROFILE,
      device_rate: 0.04,
      device_milestone_bonus: 0,
    };
    const result = calcEmployeeDeviceCommission(100000, profile);
    expect(result.milestoneCount).toBe(0);
    expect(result.milestoneBonus).toBe(0);
    expect(result.total).toBe(4000);
  });

  it("handles zero sales", () => {
    const result = calcEmployeeDeviceCommission(0, DEFAULT_EMPLOYEE_PROFILE);
    expect(result.total).toBe(0);
    expect(result.milestoneCount).toBe(0);
  });
});
