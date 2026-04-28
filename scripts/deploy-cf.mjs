#!/usr/bin/env node
// =====================================================
// ClalMobile — Cloudflare Workers deploy wrapper.
//
// Wrapper around `next build → opennextjs-cloudflare build → wrangler
// deploy`. Solves a quirk where `@opennextjs/cloudflare`'s
// populate-cache step needs `CLOUDFLARE_ACCOUNT_ID` from `process.env`,
// but neither `next build` nor `wrangler` propagate `.env.local`'s
// values to that child process by default. This wrapper:
//
//   1. Reads `.env.local` (if it exists) and merges it into the
//      current `process.env`. We do a minimal parse — no `dotenv`
//      dependency — so the wrapper has zero overhead.
//   2. Falls back to the `account_id` declared in `wrangler.json`
//      so a fresh checkout without `.env.local` still works.
//   3. Runs the three deploy steps with `stdio: "inherit"` so the
//      output streams through unchanged.
//
// To run:  node scripts/deploy-cf.mjs
// (npm run deploy:cf invokes this same script.)
// =====================================================

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/** Tiny .env parser — handles `KEY=VALUE` (no quotes / no expansion). */
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip wrapping quotes if present.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Read CLOUDFLARE_ACCOUNT_ID from wrangler.json as a fallback. */
function readWranglerAccountId() {
  try {
    const cfg = JSON.parse(readFileSync(path.join(root, "wrangler.json"), "utf8"));
    return cfg.account_id;
  } catch {
    return undefined;
  }
}

const envLocal = parseEnvFile(path.join(root, ".env.local"));
// Merge order: .env.local wins over the inherited shell env, but does
// NOT clobber any var the user explicitly exported.
for (const [key, value] of Object.entries(envLocal)) {
  if (!process.env[key]) process.env[key] = value;
}

// Ensure CLOUDFLARE_ACCOUNT_ID is set — populate-cache.js needs it.
if (!process.env.CLOUDFLARE_ACCOUNT_ID && !process.env.CF_ACCOUNT_ID) {
  const fromWrangler = readWranglerAccountId();
  if (fromWrangler) {
    process.env.CLOUDFLARE_ACCOUNT_ID = fromWrangler;
    console.log(`[deploy-cf] Using account_id from wrangler.json: ${fromWrangler}`);
  } else {
    console.error(
      "[deploy-cf] Set CLOUDFLARE_ACCOUNT_ID in .env.local or wrangler.json before deploying.",
    );
    process.exit(2);
  }
}

// Skip OpenNext's populate-cache step. Wrangler auto-detects OpenNext and
// hands the deploy off to `opennextjs-cloudflare deploy`, which does
// `populateR2IncrementalCache` first. That step calls the Cloudflare R2 API
// directly with the OAuth token from `wrangler login`; if the token doesn't
// carry the `r2:write` scope (older login sessions, custom-scoped tokens)
// the call 403s with `Authentication error` and the whole deploy aborts —
// even though the actual Worker upload would succeed.
//
// We bypass by:
//   1. Renaming `open-next.config.ts` so wrangler stops detecting it as an
//      OpenNext project and skips the auto-delegation.
//   2. Running plain `wrangler deploy` against `.open-next/worker.js` (the
//      build artifact opennext already produced — no re-build needed).
//   3. Restoring the config file.
//
// The R2 cache is populated lazily by the Worker itself on the first
// request to each ISR page (cache-on-read). The user-visible cost is a
// ~100 ms first-paint on the very first hit per page after deploy; every
// subsequent hit is the normal cached fast path.
import { renameSync } from "node:fs";
const OPEN_NEXT_CONFIG = path.join(root, "open-next.config.ts");
const OPEN_NEXT_CONFIG_HIDDEN = path.join(root, "open-next.config.ts.deploy-hidden");

const steps = [
  { name: "next build", cmd: "npm", args: ["run", "build"] },
  { name: "opennext build", cmd: "npm", args: ["run", "build:cf"] },
  {
    name: "wrangler deploy (without OpenNext populate-cache)",
    cmd: "npx",
    args: ["wrangler", "deploy"],
    before() {
      // Hide the config so wrangler doesn't auto-delegate to opennext.
      try {
        renameSync(OPEN_NEXT_CONFIG, OPEN_NEXT_CONFIG_HIDDEN);
      } catch {
        // Already hidden from a previous failed run — fine.
      }
    },
    after() {
      try {
        renameSync(OPEN_NEXT_CONFIG_HIDDEN, OPEN_NEXT_CONFIG);
      } catch {
        // Already in place.
      }
    },
  },
];

for (const step of steps) {
  console.log(`\n[deploy-cf] ▶ ${step.name}`);
  if (typeof step.before === "function") step.before();
  let result;
  try {
    result = spawnSync(step.cmd, step.args, {
      stdio: "inherit",
      shell: true,
      cwd: root,
      env: process.env,
    });
  } finally {
    // ALWAYS run after() — even on failure — so the open-next.config.ts
    // gets restored if the deploy crashes.
    if (typeof step.after === "function") step.after();
  }
  if (result.status !== 0) {
    console.error(`[deploy-cf] ✗ "${step.name}" exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[deploy-cf] ✅ Deploy complete.");
