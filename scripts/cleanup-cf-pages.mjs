#!/usr/bin/env node
/**
 * cleanup-cf-pages.mjs — bulk-delete all Cloudflare Pages deployments then
 * delete the project itself.
 *
 * Cloudflare blocks direct project deletion when there are too many
 * deployments. This script fetches every deployment via the Pages API,
 * deletes them in batches, then deletes the project.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=<token> \
 *   CLOUDFLARE_ACCOUNT_ID=660c79549da34aae48574bd1847ef291 \
 *   CF_PAGES_PROJECT=clalstore \
 *     node scripts/cleanup-cf-pages.mjs
 *
 * To generate a token:
 *   https://dash.cloudflare.com/profile/api-tokens
 *   Template: "Edit Cloudflare Workers" — or Custom token with:
 *     Account → Cloudflare Pages → Edit
 */

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "660c79549da34aae48574bd1847ef291";
const PROJECT = process.env.CF_PAGES_PROJECT || "clalstore";
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}`;
const DRY_RUN = process.argv.includes("--dry-run");

if (!TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN. Generate one at:");
  console.error("  https://dash.cloudflare.com/profile/api-tokens");
  console.error("Then run:");
  console.error('  CLOUDFLARE_API_TOKEN=xxx node scripts/cleanup-cf-pages.mjs');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function cf(method, path, body) {
  const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`CF ${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function listDeployments(page = 1, per_page = 25) {
  const data = await cf("GET", `/deployments?page=${page}&per_page=${per_page}`);
  return { items: data.result || [], total: data.result_info?.total_count ?? 0 };
}

async function deleteDeployment(id) {
  return cf("DELETE", `/deployments/${id}`);
}

async function deleteProject() {
  return cf("DELETE", "");
}

async function main() {
  console.log(`[cleanup] project=${PROJECT} account=${ACCOUNT} dry-run=${DRY_RUN}`);

  // Probe — are we authenticated?
  try {
    const project = await cf("GET", "");
    console.log(`[cleanup] project found: ${project.result?.name} (created ${project.result?.created_on})`);
  } catch (err) {
    console.error("[cleanup] auth probe failed:", err.message);
    console.error("  → verify CLOUDFLARE_API_TOKEN has 'Account · Cloudflare Pages · Edit' permission");
    process.exit(1);
  }

  let totalDeleted = 0;
  let totalFailed = 0;
  let round = 0;

  while (true) {
    round++;
    // Always pull page=1 because as we delete, page numbers shift
    const { items, total } = await listDeployments(1, 25);
    if (items.length === 0) {
      console.log(`[cleanup] no deployments remaining (round ${round})`);
      break;
    }
    console.log(`[cleanup] round ${round} — fetched ${items.length} of ${total} deployments`);

    // Concurrent deletes, capped
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (d) => {
          if (DRY_RUN) {
            console.log(`  [dry] would delete ${d.id} (${d.short_id}) ${d.environment}`);
            return;
          }
          try {
            await deleteDeployment(d.id);
            totalDeleted++;
            process.stdout.write(".");
          } catch (err) {
            totalFailed++;
            console.error(`\n  ✗ ${d.id}: ${err.message}`);
          }
        }),
      );
    }
    process.stdout.write("\n");

    // Safety: if nothing was deleted this round (all 5 errored), bail
    if (!DRY_RUN && round > 1000) {
      console.error("[cleanup] too many rounds — something is wrong");
      process.exit(1);
    }
  }

  console.log(`[cleanup] deleted ${totalDeleted} deployments, ${totalFailed} failed`);

  if (DRY_RUN) {
    console.log("[cleanup] dry-run; skipping project delete");
    return;
  }

  if (totalFailed > 0) {
    console.error("[cleanup] not deleting project — some deployments failed");
    process.exit(1);
  }

  console.log("[cleanup] deleting project…");
  await deleteProject();
  console.log(`[cleanup] ✓ project ${PROJECT} deleted`);
}

main().catch((err) => {
  console.error("[cleanup] fatal:", err.message);
  process.exit(1);
});
