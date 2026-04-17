import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cn,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatTime,
  formatDateTime,
  timeAgo,
  calcMargin,
  calcDiscount,
  truncate,
  getInitials,
  groupBy,
  sleep,
  getProductName,
  getColorName,
  getDescription,
} from "@/lib/utils";

// ─────────────────────────────────────────────
// cn — Tailwind class merger
// ─────────────────────────────────────────────
describe("cn", () => {
  it("merges simple class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles arrays", () => {
    expect(cn(["a", "b"])).toBe("a b");
  });

  it("handles undefined and null inputs gracefully", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("returns empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });
});

// ─────────────────────────────────────────────
// formatCurrency
// ─────────────────────────────────────────────
describe("formatCurrency", () => {
  it("formats a simple number with shekel sign", () => {
    expect(formatCurrency(100)).toContain("100");
    expect(formatCurrency(100).startsWith("\u20AA")).toBe(true);
  });

  it("formats thousands with locale separators", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("1");
    expect(result.startsWith("\u20AA")).toBe(true);
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("\u20AA0");
  });

  it("formats negative numbers", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500");
  });
});

// ─────────────────────────────────────────────
// formatCurrencyCompact
// ─────────────────────────────────────────────
describe("formatCurrencyCompact", () => {
  it("returns raw number for amounts under 1000", () => {
    expect(formatCurrencyCompact(500)).toBe("\u20AA500");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCurrencyCompact(1000)).toBe("\u20AA1K");
    expect(formatCurrencyCompact(5500)).toBe("\u20AA6K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCurrencyCompact(1000000)).toBe("\u20AA1.0M");
    expect(formatCurrencyCompact(2500000)).toBe("\u20AA2.5M");
  });

  it("formats exactly 999 without suffix", () => {
    expect(formatCurrencyCompact(999)).toBe("\u20AA999");
  });

  it("formats zero", () => {
    expect(formatCurrencyCompact(0)).toBe("\u20AA0");
  });
});

// ─────────────────────────────────────────────
// formatDate / formatTime / formatDateTime
// ─────────────────────────────────────────────
describe("formatDate", () => {
  it("formats a Date object", () => {
    const d = new Date(2025, 0, 15); // Jan 15, 2025
    const result = formatDate(d);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a date string", () => {
    const result = formatDate("2025-06-01T12:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatTime", () => {
  it("formats a Date object to time string", () => {
    const d = new Date(2025, 0, 15, 14, 30);
    const result = formatTime(d);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a time string", () => {
    const result = formatTime("2025-06-01T14:30:00Z");
    expect(typeof result).toBe("string");
  });
});

describe("formatDateTime", () => {
  it("combines date and time", () => {
    const d = new Date(2025, 0, 15, 14, 30);
    const result = formatDateTime(d);
    expect(result).toContain(formatDate(d));
    expect(result).toContain(formatTime(d));
  });

  it("accepts string input", () => {
    const str = "2025-06-01T14:30:00Z";
    const result = formatDateTime(str);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// timeAgo
// ─────────────────────────────────────────────
describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'now' for less than a minute ago (Arabic)", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    expect(timeAgo(now)).toBe("\u0627\u0644\u0622\u0646"); // الآن
  });

  it("returns minutes for less than an hour", () => {
    const fiveMinAgo = new Date("2025-06-15T11:55:00Z");
    const result = timeAgo(fiveMinAgo);
    expect(result).toContain("5");
    expect(result).toContain("\u062F\u0642\u064A\u0642\u0629"); // دقيقة
  });

  it("returns hours for less than a day", () => {
    const threeHoursAgo = new Date("2025-06-15T09:00:00Z");
    const result = timeAgo(threeHoursAgo);
    expect(result).toContain("3");
    expect(result).toContain("\u0633\u0627\u0639\u0629"); // ساعة
  });

  it("returns days for less than 30 days", () => {
    const fiveDaysAgo = new Date("2025-06-10T12:00:00Z");
    const result = timeAgo(fiveDaysAgo);
    expect(result).toContain("5");
    expect(result).toContain("\u064A\u0648\u0645"); // يوم
  });

  it("returns formatted date for 30+ days", () => {
    const longAgo = new Date("2025-01-01T12:00:00Z");
    const result = timeAgo(longAgo);
    // Should fall through to formatDate
    expect(result).toBe(formatDate(longAgo));
  });

  it("accepts string input", () => {
    const result = timeAgo("2025-06-15T11:50:00Z");
    expect(result).toContain("10");
  });
});

// ─────────────────────────────────────────────
// calcMargin
// ─────────────────────────────────────────────
describe("calcMargin", () => {
  it("calculates margin correctly", () => {
    expect(calcMargin(100, 60)).toBe(40);
  });

  it("returns 0 when price is zero (avoid division by zero)", () => {
    expect(calcMargin(0, 60)).toBe(0);
  });

  it("returns 0 when price is negative", () => {
    expect(calcMargin(-10, 60)).toBe(0);
  });

  it("handles 100% margin (cost = 0)", () => {
    expect(calcMargin(100, 0)).toBe(100);
  });

  it("handles negative margin (cost > price)", () => {
    const result = calcMargin(50, 80);
    expect(result).toBe(-60);
  });

  it("rounds the result", () => {
    // (100 - 33) / 100 = 0.67 => 67%
    expect(calcMargin(100, 33)).toBe(67);
  });
});

// ─────────────────────────────────────────────
// calcDiscount
// ─────────────────────────────────────────────
describe("calcDiscount", () => {
  it("calculates discount correctly", () => {
    expect(calcDiscount(80, 100)).toBe(20);
  });

  it("returns 0 when oldPrice is zero (avoid division by zero)", () => {
    expect(calcDiscount(80, 0)).toBe(0);
  });

  it("returns 0 when oldPrice is negative", () => {
    expect(calcDiscount(80, -100)).toBe(0);
  });

  it("handles no discount (same price)", () => {
    expect(calcDiscount(100, 100)).toBe(0);
  });

  it("handles price higher than old price (negative discount)", () => {
    expect(calcDiscount(120, 100)).toBe(-20);
  });
});

// ─────────────────────────────────────────────
// truncate
// ─────────────────────────────────────────────
describe("truncate", () => {
  it("truncates string longer than maxLength", () => {
    expect(truncate("Hello World", 5)).toBe("Hello...");
  });

  it("does not truncate string shorter than maxLength", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
  });

  it("does not truncate string equal to maxLength", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles maxLength of 0", () => {
    expect(truncate("Hello", 0)).toBe("...");
  });
});

// ─────────────────────────────────────────────
// getInitials
// ─────────────────────────────────────────────
describe("getInitials", () => {
  it("returns first two initials from a full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns single initial for single word name", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("caps at two initials for long names", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  it("handles Arabic names", () => {
    const result = getInitials("\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F");
    expect(result.length).toBe(2);
  });
});

// ─────────────────────────────────────────────
// groupBy
// ─────────────────────────────────────────────
describe("groupBy", () => {
  it("groups items by a string key", () => {
    const items = [
      { type: "fruit", name: "apple" },
      { type: "fruit", name: "banana" },
      { type: "vegetable", name: "carrot" },
    ];
    const result = groupBy(items, "type");
    expect(result.fruit).toHaveLength(2);
    expect(result.vegetable).toHaveLength(1);
  });

  it("returns empty object for empty array", () => {
    const result = groupBy([], "id" as never);
    expect(result).toEqual({});
  });

  it("handles items where all have same key", () => {
    const items = [
      { category: "A", val: 1 },
      { category: "A", val: 2 },
    ];
    const result = groupBy(items, "category");
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.A).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────
// sleep
// ─────────────────────────────────────────────
describe("sleep", () => {
  it("resolves after the specified time", async () => {
    vi.useFakeTimers();
    const p = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("returns a Promise", () => {
    const result = sleep(0);
    expect(result).toBeInstanceOf(Promise);
  });
});

// ─────────────────────────────────────────────
// getProductName
// ─────────────────────────────────────────────
describe("getProductName", () => {
  const product = { name_ar: "iPhone 15 Arabic", name_he: "iPhone 15 Hebrew" };

  it("returns Arabic name when lang is ar", () => {
    expect(getProductName(product, "ar")).toBe("iPhone 15 Arabic");
  });

  it("returns Hebrew name when lang is he", () => {
    expect(getProductName(product, "he")).toBe("iPhone 15 Hebrew");
  });

  it("falls back to Arabic name when Hebrew is missing", () => {
    const noHe = { name_ar: "Arabic Only" };
    expect(getProductName(noHe, "he")).toBe("Arabic Only");
  });

  it("falls back to Arabic name when Hebrew is empty string", () => {
    const emptyHe = { name_ar: "Arabic", name_he: "" };
    expect(getProductName(emptyHe, "he")).toBe("Arabic");
  });
});

// ─────────────────────────────────────────────
// getColorName
// ─────────────────────────────────────────────
describe("getColorName", () => {
  const color = { name_ar: "\u0623\u0633\u0648\u062F", name_he: "\u05E9\u05D7\u05D5\u05E8" };

  it("returns Arabic color name when lang is ar", () => {
    expect(getColorName(color, "ar")).toBe("\u0623\u0633\u0648\u062F");
  });

  it("returns Hebrew color name when lang is he", () => {
    expect(getColorName(color, "he")).toBe("\u05E9\u05D7\u05D5\u05E8");
  });

  it("falls back to Arabic when Hebrew is missing", () => {
    const noHe = { name_ar: "\u0623\u0628\u064A\u0636" };
    expect(getColorName(noHe, "he")).toBe("\u0623\u0628\u064A\u0636");
  });
});

// ─────────────────────────────────────────────
// getDescription
// ─────────────────────────────────────────────
describe("getDescription", () => {
  it("returns Arabic description for lang=ar", () => {
    const p = { description_ar: "Arabic desc", description_he: "Hebrew desc" };
    expect(getDescription(p, "ar")).toBe("Arabic desc");
  });

  it("returns Hebrew description for lang=he", () => {
    const p = { description_ar: "Arabic desc", description_he: "Hebrew desc" };
    expect(getDescription(p, "he")).toBe("Hebrew desc");
  });

  it("falls back to Arabic description when Hebrew is missing for lang=he", () => {
    const p = { description_ar: "Arabic desc" };
    expect(getDescription(p, "he")).toBe("Arabic desc");
  });

  it("returns empty string when no descriptions exist", () => {
    expect(getDescription({}, "ar")).toBe("");
    expect(getDescription({}, "he")).toBe("");
  });

  it("returns empty string when description_ar is undefined for lang=ar", () => {
    expect(getDescription({ description_he: "Hebrew" }, "ar")).toBe("");
  });
});
