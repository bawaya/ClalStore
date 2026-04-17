import { describe, it, expect } from "vitest";
import {
  calculateTier,
  getNextTier,
  pointsToNextTier,
  calculatePointsForOrder,
  calculatePointsValue,
  LOYALTY_CONFIG,
} from "@/lib/loyalty";

// ─────────────────────────────────────────────
// calculateTier
// ─────────────────────────────────────────────
describe("calculateTier", () => {
  it("returns bronze for 0 lifetime points", () => {
    expect(calculateTier(0)).toBe("bronze");
  });

  it("returns bronze for points below 500", () => {
    expect(calculateTier(499)).toBe("bronze");
  });

  it("returns silver for exactly 500 points", () => {
    expect(calculateTier(500)).toBe("silver");
  });

  it("returns silver for points between 500 and 1999", () => {
    expect(calculateTier(1000)).toBe("silver");
    expect(calculateTier(1999)).toBe("silver");
  });

  it("returns gold for exactly 2000 points", () => {
    expect(calculateTier(2000)).toBe("gold");
  });

  it("returns gold for points between 2000 and 4999", () => {
    expect(calculateTier(3000)).toBe("gold");
    expect(calculateTier(4999)).toBe("gold");
  });

  it("returns platinum for exactly 5000 points", () => {
    expect(calculateTier(5000)).toBe("platinum");
  });

  it("returns platinum for very high points", () => {
    expect(calculateTier(100000)).toBe("platinum");
  });
});

// ─────────────────────────────────────────────
// getNextTier
// ─────────────────────────────────────────────
describe("getNextTier", () => {
  it("returns silver as the next tier after bronze", () => {
    expect(getNextTier("bronze")).toBe("silver");
  });

  it("returns gold as the next tier after silver", () => {
    expect(getNextTier("silver")).toBe("gold");
  });

  it("returns platinum as the next tier after gold", () => {
    expect(getNextTier("gold")).toBe("platinum");
  });

  it("returns null for platinum (highest tier)", () => {
    expect(getNextTier("platinum")).toBeNull();
  });
});

// ─────────────────────────────────────────────
// pointsToNextTier
// ─────────────────────────────────────────────
describe("pointsToNextTier", () => {
  it("returns points needed from bronze to silver", () => {
    expect(pointsToNextTier(0, "bronze")).toBe(500);
    expect(pointsToNextTier(200, "bronze")).toBe(300);
    expect(pointsToNextTier(499, "bronze")).toBe(1);
  });

  it("returns points needed from silver to gold", () => {
    expect(pointsToNextTier(500, "silver")).toBe(1500);
    expect(pointsToNextTier(1000, "silver")).toBe(1000);
  });

  it("returns points needed from gold to platinum", () => {
    expect(pointsToNextTier(2000, "gold")).toBe(3000);
    expect(pointsToNextTier(4000, "gold")).toBe(1000);
  });

  it("returns 0 for platinum (no next tier)", () => {
    expect(pointsToNextTier(5000, "platinum")).toBe(0);
    expect(pointsToNextTier(10000, "platinum")).toBe(0);
  });

  it("returns 0 when points already exceed next tier threshold", () => {
    // Already at 600 points as bronze, next tier (silver) is 500
    // But function uses max(0, ...) so even if we overshoot it returns 0
    expect(pointsToNextTier(600, "bronze")).toBe(0);
  });
});

// ─────────────────────────────────────────────
// calculatePointsForOrder
// ─────────────────────────────────────────────
describe("calculatePointsForOrder", () => {
  it("calculates base points (1 point per shekel, bronze multiplier 1x)", () => {
    expect(calculatePointsForOrder(100, "bronze")).toBe(100);
  });

  it("applies silver multiplier (1.25x)", () => {
    expect(calculatePointsForOrder(100, "silver")).toBe(125);
  });

  it("applies gold multiplier (1.5x)", () => {
    expect(calculatePointsForOrder(100, "gold")).toBe(150);
  });

  it("applies platinum multiplier (2x)", () => {
    expect(calculatePointsForOrder(100, "platinum")).toBe(200);
  });

  it("floors fractional points", () => {
    // 33 * 1.25 = 41.25 -> 41
    expect(calculatePointsForOrder(33, "silver")).toBe(41);
  });

  it("returns 0 for zero-value order", () => {
    expect(calculatePointsForOrder(0, "gold")).toBe(0);
  });

  it("floors base points before multiplier", () => {
    // 99.5 is not a normal integer total, but the function does Math.floor on both steps
    expect(calculatePointsForOrder(99, "bronze")).toBe(99);
  });
});

// ─────────────────────────────────────────────
// calculatePointsValue
// ─────────────────────────────────────────────
describe("calculatePointsValue", () => {
  it("converts points to shekel value (0.1 shekel per point)", () => {
    expect(calculatePointsValue(100)).toBe(10);
  });

  it("returns 0 for 0 points", () => {
    expect(calculatePointsValue(0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(calculatePointsValue(1)).toBe(0.1);
    expect(calculatePointsValue(3)).toBe(0.3);
  });

  it("handles large point values", () => {
    expect(calculatePointsValue(10000)).toBe(1000);
  });

  it("handles odd point values with proper rounding", () => {
    // 7 * 0.1 = 0.7
    expect(calculatePointsValue(7)).toBe(0.7);
  });
});

// ─────────────────────────────────────────────
// LOYALTY_CONFIG structure
// ─────────────────────────────────────────────
describe("LOYALTY_CONFIG", () => {
  it("defines pointsPerShekel as 1", () => {
    expect(LOYALTY_CONFIG.pointsPerShekel).toBe(1);
  });

  it("defines shekelPerPoint as 0.1", () => {
    expect(LOYALTY_CONFIG.shekelPerPoint).toBe(0.1);
  });

  it("defines four tiers", () => {
    const tiers = Object.keys(LOYALTY_CONFIG.tiers);
    expect(tiers).toContain("bronze");
    expect(tiers).toContain("silver");
    expect(tiers).toContain("gold");
    expect(tiers).toContain("platinum");
    expect(tiers).toHaveLength(4);
  });

  it("tier min points are in ascending order", () => {
    expect(LOYALTY_CONFIG.tiers.bronze.minPoints).toBeLessThan(LOYALTY_CONFIG.tiers.silver.minPoints);
    expect(LOYALTY_CONFIG.tiers.silver.minPoints).toBeLessThan(LOYALTY_CONFIG.tiers.gold.minPoints);
    expect(LOYALTY_CONFIG.tiers.gold.minPoints).toBeLessThan(LOYALTY_CONFIG.tiers.platinum.minPoints);
  });

  it("tier multipliers are in ascending order", () => {
    expect(LOYALTY_CONFIG.tiers.bronze.multiplier).toBeLessThan(LOYALTY_CONFIG.tiers.silver.multiplier);
    expect(LOYALTY_CONFIG.tiers.silver.multiplier).toBeLessThan(LOYALTY_CONFIG.tiers.gold.multiplier);
    expect(LOYALTY_CONFIG.tiers.gold.multiplier).toBeLessThan(LOYALTY_CONFIG.tiers.platinum.multiplier);
  });
});
