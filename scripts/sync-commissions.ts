#!/usr/bin/env node
/**
 * scripts/sync-commissions.ts
 *
 * Hourly commission sync — run by .github/workflows/commission-sync.yml.
 *
 * Pulls newly-commissionable orders from the last 48 hours and registers
 * any missing commission_sales rows via syncOrdersToCommissions. Uses
 * service_role via createAdminSupabase (reads env).
 *
 * Idempotent by virtue of commission_sales partial unique indexes.
 */

import { syncOrdersToCommissions } from "../lib/commissions/sync-orders";

function yyyyMmDd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 48 * 3600 * 1000); // last 48h
  const startDate = yyyyMmDd(start);
  const endDate = yyyyMmDd(now);

  console.log(`[sync-commissions] syncing orders ${startDate} .. ${endDate}`);
  const t0 = Date.now();

  try {
    const result = await syncOrdersToCommissions(startDate, endDate);
    const elapsed = Date.now() - t0;
    console.log(
      `[sync-commissions] ok in ${elapsed}ms — ${JSON.stringify(result)}`,
    );
    process.exit(0);
  } catch (err) {
    console.error("[sync-commissions] failed:", err);
    process.exit(1);
  }
}

main();
