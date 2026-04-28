#!/usr/bin/env node
// =====================================================
// ClalMobile — Workers Analytics Engine query helper.
//
// Reads recent metrics from the `clalstore_analytics` dataset and
// pretty-prints them. Useful as a quick sanity check after a deploy:
//   "did the binding wire correctly? are events flowing?"
//
// Usage:
//   CLOUDFLARE_API_TOKEN=xxx node scripts/check-analytics.mjs
//
// Get the token from:
//   dash.cloudflare.com → My Profile → API Tokens → Create Token →
//   Custom Token → Permissions: "Account · Account Analytics · Read"
//
// The token can also live in `.env.local` as
// `CLOUDFLARE_API_TOKEN=...`; this script doesn't pull it from there
// to keep the helper standalone (no `dotenv` import needed).
// =====================================================

const ACCOUNT_ID = "660c79549da34aae48574bd1847ef291";
const DATASET = "clalstore_analytics";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!TOKEN) {
  console.error("❌ CLOUDFLARE_API_TOKEN env var is not set.");
  console.error("   Get a token from https://dash.cloudflare.com/profile/api-tokens");
  console.error("   (permission: Account · Account Analytics · Read)");
  console.error("   Then run:  CLOUDFLARE_API_TOKEN=<token> node scripts/check-analytics.mjs");
  process.exit(2);
}

async function querySql(sql) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  // Cloudflare returns rows in JSON-lines or a single JSON object depending on
  // the query shape. Try JSON first, fall back to text.
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fmtRows(rows, label) {
  console.log(`\n=== ${label} ===`);
  if (!rows || (Array.isArray(rows.data) && rows.data.length === 0)) {
    console.log("(no data — either the binding hasn't received any events yet, or the query returned 0 rows)");
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  console.log(`Querying ${DATASET} for the last 24 hours...`);

  // 1. Total events per metric
  fmtRows(
    await querySql(`
      SELECT index1 AS metric, count() AS events
      FROM ${DATASET}
      WHERE timestamp > NOW() - INTERVAL '24' HOUR
      GROUP BY index1
      ORDER BY events DESC
    `),
    "Events by metric (24h)",
  );

  // 2. WhatsApp send breakdown
  fmtRows(
    await querySql(`
      SELECT
        blob1 AS type,
        blob2 AS state,
        count() AS events
      FROM ${DATASET}
      WHERE index1 = 'whatsapp_sent'
        AND timestamp > NOW() - INTERVAL '24' HOUR
      GROUP BY blob1, blob2
      ORDER BY events DESC
    `),
    "WhatsApp sends by type/state (24h)",
  );

  // 3. Payment outcomes
  fmtRows(
    await querySql(`
      SELECT
        blob2 AS status,
        blob3 AS provider,
        count() AS events,
        SUM(double1) AS total_amount
      FROM ${DATASET}
      WHERE index1 = 'payment_outcome'
        AND timestamp > NOW() - INTERVAL '24' HOUR
      GROUP BY blob2, blob3
    `),
    "Payment outcomes (24h)",
  );

  // 4. API 5xx errors per route
  fmtRows(
    await querySql(`
      SELECT
        blob1 AS route,
        blob2 AS status,
        count() AS events
      FROM ${DATASET}
      WHERE index1 = 'api_5xx'
        AND timestamp > NOW() - INTERVAL '24' HOUR
      GROUP BY blob1, blob2
      ORDER BY events DESC
      LIMIT 20
    `),
    "API 5xx errors per route (24h)",
  );

  console.log("\n✅ Done. If everything is empty, give the deploy 2-5 minutes and use the site to generate events.");
}

main().catch((err) => {
  console.error("❌ Query failed:", err.message);
  process.exit(1);
});
