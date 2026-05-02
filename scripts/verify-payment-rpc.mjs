#!/usr/bin/env node
// =====================================================
// verify-payment-rpc.mjs
//
// End-to-end verification that `process_payment_callback` RPC works against
// the production schema. Catches schema gaps, missing columns, type
// mismatches, and broken triggers that unit tests with mocked Supabase
// cannot detect.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_... \
//   SUPABASE_PROJECT_REF=nhvcfmhvrcsggpdjaejk \
//     node scripts/verify-payment-rpc.mjs
//
// If env vars are missing, falls back to reading the first 88 lines of
// .env.local (avoids the UTF-16 corruption past line 89).
//
// Exit codes:
//   0  — RPC works end-to-end
//   1  — Mgmt API HTTP error / missing config
//   2  — RPC failed (schema gap, trigger error, type mismatch, etc.)
//   3  — Verification mismatch (RPC returned OK but row not updated)
// =====================================================

import { readFileSync } from "node:fs";

const TEST_ORDER_ID = "TEST-RPC-VERIFY-" + Date.now().toString(36).toUpperCase();
const TEST_TXN_ID = "TEST-TXN-" + Date.now();

function loadConfig() {
  let pat = process.env.SUPABASE_ACCESS_TOKEN;
  let ref = process.env.SUPABASE_PROJECT_REF || "nhvcfmhvrcsggpdjaejk";

  if (!pat) {
    try {
      const raw = readFileSync(".env.local", "utf8");
      // Only read the leading ASCII portion. The .env.local in this repo has
      // UTF-16 corruption past line 89 (Sentry DSN paste). The first 88 lines
      // are safe.
      const head = raw.split(/\r?\n/).slice(0, 88).join("\n");
      const m = head.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
      if (m) pat = m[1].trim();
    } catch {
      /* ignore */
    }
  }

  if (!pat) {
    console.error("FATAL: SUPABASE_ACCESS_TOKEN not in env and not found in .env.local");
    process.exit(1);
  }
  return { pat, ref };
}

async function runSql(pat, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, status: res.status, body };
}

async function cleanup(pat, ref) {
  const sql = `
    DELETE FROM audit_log WHERE entity_id = '${TEST_ORDER_ID}';
    DELETE FROM orders WHERE id = '${TEST_ORDER_ID}';
  `;
  await runSql(pat, ref, sql);
}

async function pickCustomerId(pat, ref) {
  const r = await runSql(pat, ref, "SELECT id FROM customers LIMIT 1;");
  if (!r.ok || !Array.isArray(r.body) || r.body.length === 0) return null;
  return r.body[0].id;
}

function step(name) {
  process.stdout.write(`▸ ${name} ... `);
}
function ok(msg = "OK") {
  console.log(msg);
}
function fail(msg, detail) {
  console.log("FAIL");
  console.error("   ", msg);
  if (detail) console.error("   ", JSON.stringify(detail, null, 2));
}

async function main() {
  const { pat, ref } = loadConfig();
  console.log(`[verify-payment-rpc] project ref: ${ref}`);
  console.log(`[verify-payment-rpc] test order id: ${TEST_ORDER_ID}\n`);

  // 1. Pre-clean (in case a previous run left a stale row)
  step("pre-cleanup");
  await cleanup(pat, ref);
  ok();

  // 2. Pick a real customer to FK against
  step("fetching reference customer_id");
  const customerId = await pickCustomerId(pat, ref);
  if (!customerId) {
    fail("no customers in DB to use as FK");
    process.exit(2);
  }
  ok(customerId);

  try {
    // 3. Insert minimal valid order
    step("INSERT test order");
    const insertSql = `
      INSERT INTO orders (
        id, customer_id, status, source,
        items_total, total,
        payment_method, payment_status,
        shipping_city, shipping_address
      ) VALUES (
        '${TEST_ORDER_ID}',
        '${customerId}',
        'new',
        'manual',
        100,
        100,
        'credit',
        'pending',
        'TEST_CITY',
        'TEST_ADDRESS'
      );
    `;
    const ins = await runSql(pat, ref, insertSql);
    if (!ins.ok) {
      fail("INSERT failed — schema or constraint issue", ins.body);
      process.exit(2);
    }
    ok();

    // 4. Call the RPC exactly the way /api/payment/callback does
    step("CALL process_payment_callback (RPC)");
    const rpcSql = `
      SELECT process_payment_callback(
        '${TEST_ORDER_ID}',
        'paid',
        'approved',
        '${TEST_TXN_ID}',
        '{"verified":true,"source":"verification-script"}'::jsonb,
        'verification-test',
        '{"source":"verify-payment-rpc.mjs"}'::jsonb
      ) AS result;
    `;
    const rpc = await runSql(pat, ref, rpcSql);
    if (!rpc.ok) {
      fail("RPC failed — this is the production bug we are checking for", rpc.body);
      process.exit(2);
    }
    ok(JSON.stringify(rpc.body[0]?.result));

    // 5. Verify the row was actually updated
    step("verify orders row");
    const verifySql = `
      SELECT payment_status, payment_transaction_id, status
      FROM orders WHERE id = '${TEST_ORDER_ID}';
    `;
    const ver = await runSql(pat, ref, verifySql);
    if (!ver.ok || !Array.isArray(ver.body) || ver.body.length === 0) {
      fail("order row missing after RPC", ver.body);
      process.exit(3);
    }
    const row = ver.body[0];
    const issues = [];
    if (row.payment_status !== "paid") issues.push(`payment_status=${row.payment_status} (expected paid)`);
    if (row.payment_transaction_id !== TEST_TXN_ID) issues.push(`payment_transaction_id=${row.payment_transaction_id} (expected ${TEST_TXN_ID})`);
    if (row.status !== "approved") issues.push(`status=${row.status} (expected approved)`);
    if (issues.length > 0) {
      fail("row did not match expected values", { issues, row });
      process.exit(3);
    }
    ok(`payment_status=paid, txn_id set, status=approved`);

    // 6. Verify audit_log entry was inserted
    step("verify audit_log entry");
    const auditSql = `
      SELECT count(*)::int AS cnt FROM audit_log
      WHERE entity_id = '${TEST_ORDER_ID}' AND user_name = 'iCredit';
    `;
    const aud = await runSql(pat, ref, auditSql);
    if (!aud.ok || aud.body[0]?.cnt < 1) {
      fail("audit_log row not inserted by RPC", aud.body);
      process.exit(3);
    }
    ok(`${aud.body[0].cnt} row(s)`);

    // 7. Test idempotency / replay protection (UNIQUE INDEX)
    step("replay-protection — UNIQUE INDEX must reject duplicate txn_id on a different order");
    const replayInsertSql = `
      INSERT INTO orders (
        id, customer_id, status, source,
        items_total, total,
        payment_method, payment_status,
        payment_transaction_id,
        shipping_city, shipping_address
      ) VALUES (
        '${TEST_ORDER_ID}-REPLAY',
        '${customerId}',
        'new', 'manual',
        100, 100,
        'credit', 'pending',
        '${TEST_TXN_ID}',
        'TEST_CITY', 'TEST_ADDRESS'
      );
    `;
    const replay = await runSql(pat, ref, replayInsertSql);
    if (replay.ok) {
      fail("replay protection FAILED — UNIQUE INDEX did not reject duplicate txn_id");
      // Cleanup the replay row
      await runSql(pat, ref, `DELETE FROM orders WHERE id = '${TEST_ORDER_ID}-REPLAY';`);
      process.exit(3);
    }
    const errMsg = replay.body?.message || "";
    if (!/duplicate key|orders_payment_transaction_id_unique|23505/i.test(errMsg)) {
      fail("replay protection rejected the insert — but with an unexpected error", replay.body);
      process.exit(3);
    }
    ok("rejected with 23505 as expected");

    console.log("\n✅ All checks passed — process_payment_callback works end-to-end against production schema.");
    process.exit(0);
  } finally {
    step("\npost-cleanup");
    await cleanup(pat, ref);
    ok();
  }
}

main().catch((err) => {
  console.error("\nUNHANDLED ERROR:", err);
  process.exit(1);
});
