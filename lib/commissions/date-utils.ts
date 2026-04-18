// =====================================================
// ClalMobile — Commission date utilities
// Extracted from calculator.ts + dashboard/route.ts + ledger.ts
// (audit issue 4.28 — duplicated countWorkingDays / lastDayOfMonth).
// =====================================================

/** Count working days between two dates (inclusive) — excludes Saturday / Shabbat. */
export function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 6) count++; // 6 = Saturday
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Last day of a YYYY-MM month as YYYY-MM-DD (issue 4.17 fix). */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // new Date(year, monthIndex+1, 0) = last day of monthIndex
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}
