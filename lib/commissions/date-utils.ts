// =====================================================
// ClalMobile — Commission date utilities
// Extracted from calculator.ts + dashboard/route.ts + ledger.ts
// (audit issue 4.28 — duplicated countWorkingDays / lastDayOfMonth).
// =====================================================

/**
 * Count working days between two dates (inclusive).
 *
 * Israeli work week = Sunday (0) through Thursday (4). Friday (5) and
 * Saturday (6) are weekend / Shabbat and are excluded.
 *
 * Previously this only excluded Saturday — surfaced while writing tests
 * 2026-04-18. The bug caused dailyRequired calculations in the dashboard
 * to divide by 1 extra day per week, understating how much the employee
 * needed to sell per actual working day.
 */
export function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    // Sun (0) .. Thu (4) count as working days.
    if (day >= 0 && day <= 4) count++;
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
