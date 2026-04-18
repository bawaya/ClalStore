/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pure unit tests for commission date utilities — spec 3G.
 *
 * Tests only the *exported* API:
 *   - countWorkingDays(start, end)
 *   - lastDayOfMonth("YYYY-MM")
 *
 * Israeli work week = Sunday (0) through Thursday (4). Friday (5) and
 * Saturday (6) are weekend. The implementation was corrected on
 * 2026-04-18 from "exclude Saturday only" to "exclude Friday + Saturday"
 * after tests surfaced the divergence from the documented rule.
 */

import { describe, it, expect } from "vitest";
import {
  countWorkingDays,
  lastDayOfMonth,
} from "@/lib/commissions/date-utils";

// ═══════════════════════════════════════════════════════════════
// countWorkingDays
// ═══════════════════════════════════════════════════════════════
describe("countWorkingDays", () => {
  it("counts a full work-week (Sun..Thu) as 5 days", async () => {
    // 2026-04-19 is a Sunday (getDay=0)
    const start = new Date(2026, 3, 19); // Sun
    const end = new Date(2026, 3, 23); // Thu
    expect(countWorkingDays(start, end)).toBe(5);
  });

  it("excludes Saturday from the count", async () => {
    // 2026-04-18 is Saturday — a one-day range of Saturday → 0
    const start = new Date(2026, 3, 18);
    const end = new Date(2026, 3, 18);
    expect(start.getDay()).toBe(6); // sanity
    expect(countWorkingDays(start, end)).toBe(0);
  });

  it("single working day range (Monday only) → 1", async () => {
    const start = new Date(2026, 3, 20); // Mon
    const end = new Date(2026, 3, 20);
    expect(countWorkingDays(start, end)).toBe(1);
  });

  it("a Sun→Sat range counts 5 (Fri + Sat excluded)", async () => {
    const start = new Date(2026, 3, 19); // Sun
    const end = new Date(2026, 3, 25); // Sat (next)
    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    // 7 total days, minus Fri + Sat = 5
    expect(countWorkingDays(start, end)).toBe(5);
  });

  it("Friday only → 0 (Friday is weekend in Israel)", async () => {
    const start = new Date(2026, 3, 24); // Fri
    const end = new Date(2026, 3, 24);
    expect(start.getDay()).toBe(5);
    expect(countWorkingDays(start, end)).toBe(0);
  });

  it("returns 0 when start > end", async () => {
    const start = new Date(2026, 3, 25);
    const end = new Date(2026, 3, 20);
    expect(countWorkingDays(start, end)).toBe(0);
  });

  it("cross-month range (Apr 28 → May 4 2026) — 5 weekdays excl. Fri+Sat", async () => {
    // Apr 28 Tue, 29 Wed, 30 Thu, May 1 Fri(excluded), 2 Sat(excluded), 3 Sun, 4 Mon
    const start = new Date(2026, 3, 28);
    const end = new Date(2026, 4, 4);
    // 7 days - 1 Fri - 1 Sat = 5
    expect(countWorkingDays(start, end)).toBe(5);
  });

  it("handles a full month (April 2026) — 30 days - 4 Fri - 4 Sat = 22", async () => {
    const start = new Date(2026, 3, 1);
    const end = new Date(2026, 3, 30);
    // Fridays in April 2026: 3, 10, 17, 24 → 4 Fris
    // Saturdays in April 2026: 4, 11, 18, 25 → 4 Sats
    expect(countWorkingDays(start, end)).toBe(30 - 4 - 4);
  });
});

// ═══════════════════════════════════════════════════════════════
// lastDayOfMonth
// ═══════════════════════════════════════════════════════════════
describe("lastDayOfMonth", () => {
  it("'2026-02' → '2026-02-28' (non-leap year)", async () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });

  it("'2024-02' → '2024-02-29' (leap year)", async () => {
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29");
  });

  it("'2000-02' → '2000-02-29' (centurial leap)", async () => {
    expect(lastDayOfMonth("2000-02")).toBe("2000-02-29");
  });

  it("'1900-02' → '1900-02-28' (centurial non-leap)", async () => {
    expect(lastDayOfMonth("1900-02")).toBe("1900-02-28");
  });

  it("'2026-04' → '2026-04-30' (30-day month)", async () => {
    expect(lastDayOfMonth("2026-04")).toBe("2026-04-30");
  });

  it("'2026-12' → '2026-12-31' (year end)", async () => {
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });

  it("'2026-01' → '2026-01-31' (year start)", async () => {
    expect(lastDayOfMonth("2026-01")).toBe("2026-01-31");
  });

  it("all 30-day months return day=30", async () => {
    for (const m of ["04", "06", "09", "11"]) {
      expect(lastDayOfMonth(`2026-${m}`)).toBe(`2026-${m}-30`);
    }
  });

  it("all 31-day months return day=31", async () => {
    for (const m of ["01", "03", "05", "07", "08", "10", "12"]) {
      expect(lastDayOfMonth(`2026-${m}`)).toBe(`2026-${m}-31`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ISO format / timezone sanity
// ═══════════════════════════════════════════════════════════════
describe("lastDayOfMonth — ISO format / timezone sanity", () => {
  it("always returns YYYY-MM-DD (10 chars, no trailing time zone)", async () => {
    for (const m of ["2026-01", "2026-02", "2024-02", "2026-12"]) {
      const result = lastDayOfMonth(m);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.length).toBe(10);
    }
  });

  it("month + day portions are zero-padded", async () => {
    const result = lastDayOfMonth("2026-01");
    const [y, mo, d] = result.split("-");
    expect(y.length).toBe(4);
    expect(mo.length).toBe(2);
    expect(d.length).toBe(2);
  });

  it("returns a stable value for a given month (idempotent)", async () => {
    const a = lastDayOfMonth("2026-07");
    const b = lastDayOfMonth("2026-07");
    expect(a).toBe(b);
  });

  it("no trailing zeroes / time portion leak", async () => {
    const result = lastDayOfMonth("2026-03");
    expect(result).not.toContain("T");
    expect(result).not.toContain("Z");
    expect(result).not.toContain("00:00");
  });
});
