/**
 * Prepare OpenNext output for Cloudflare Pages deployment.
 *
 * Cloudflare Pages expects a `_worker.js/` directory inside the output dir
 * with `index.js` as entry point + all server modules alongside it.
 *
 * OpenNext outputs:
 *   .open-next/worker.js          ← entry point (imports from ./cloudflare, ./middleware, etc.)
 *   .open-next/cloudflare/        ← runtime helpers
 *   .open-next/middleware/         ← middleware handler
 *   .open-next/server-functions/   ← route handlers
 *   .open-next/.build/            ← durable objects
 *   .open-next/cache/             ← cache adaptor
 *   .open-next/cloudflare-templates/
 *   .open-next/dynamodb-provider/
 *   .open-next/assets/            ← static files (Pages output dir)
 *
 * This script copies the worker + server dirs into assets/_worker.js/ so Pages can serve them.
 */

import { cpSync, mkdirSync, copyFileSync, existsSync, rmSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OPEN_NEXT = ".open-next";
const WORKER_DIR = join(OPEN_NEXT, "assets", "_worker.js");

// Clean previous build
if (existsSync(WORKER_DIR)) {
  cpSync(WORKER_DIR, WORKER_DIR, { recursive: true, force: true });
}
mkdirSync(WORKER_DIR, { recursive: true });

// Copy worker entry point as index.js
copyFileSync(join(OPEN_NEXT, "worker.js"), join(WORKER_DIR, "index.js"));

// Copy all server directories that worker.js imports from
const serverDirs = [
  "cloudflare",
  "middleware",
  "server-functions",
  ".build",
  "cache",
  "cloudflare-templates",
  "dynamodb-provider",
];

for (const dir of serverDirs) {
  const src = join(OPEN_NEXT, dir);
  if (existsSync(src)) {
    cpSync(src, join(WORKER_DIR, dir), { recursive: true });
  }
}

// ── Post-build cleanup: remove unused Next.js files to reduce bundle size ──
const nextDist = join(WORKER_DIR, "server-functions", "default", "node_modules", "next", "dist");
if (existsSync(nextDist)) {
  const removals = [
    // Font metrics JSON — 4.2 MB, not used (no next/font usage in app)
    join(nextDist, "server", "capsize-font-metrics.json"),
    // @vercel/og — 3.1 MB, dynamic icons removed in favor of static SVGs
    join(nextDist, "compiled", "@vercel"),
    // Dev-only code — not needed in production
    join(nextDist, "server", "dev"),
    // HTTP compression — Cloudflare handles this at edge
    join(nextDist, "compiled", "compression"),
    // CLI tools — not needed at runtime
    join(nextDist, "cli"),
    // Telemetry — not needed at runtime
    join(nextDist, "telemetry"),
    // Export utilities — not needed at runtime
    join(nextDist, "export"),
    // Build utilities — not needed at runtime
    join(nextDist, "build"),
    // tar — not needed at runtime
    join(nextDist, "compiled", "tar"),
    // watchpack — dev file watching, not needed at runtime
    join(nextDist, "compiled", "watchpack"),
    // commander — CLI argument parsing, not needed at runtime
    join(nextDist, "compiled", "commander"),
    // comment-json — config parsing, not needed at runtime
    join(nextDist, "compiled", "comment-json"),
    // conf — config management, not needed at runtime
    join(nextDist, "compiled", "conf"),
  ];

  let totalSaved = 0;
  for (const target of removals) {
    if (existsSync(target)) {
      const stat = statSync(target);
      let size = 0;
      if (stat.isDirectory()) {
        // Calculate directory size
        const calcSize = (dir) => {
          let s = 0;
          try {
            const items = readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
              const p = join(dir, item.name);
              s += item.isDirectory() ? calcSize(p) : statSync(p).size;
            }
          } catch {}
          return s;
        };
        size = calcSize(target);
        rmSync(target, { recursive: true, force: true });
      } else {
        size = stat.size;
        rmSync(target, { force: true });
      }
      totalSaved += size;
      console.log(`  🗑️  Removed ${target.split("next/dist/")[1] || target} (${(size / 1024).toFixed(0)} KB)`);
    }
  }
  console.log(`\n  📦 Total saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
}

// Report final size
const calcDirSize = (dir) => {
  let total = 0;
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const p = join(dir, item.name);
      total += item.isDirectory() ? calcDirSize(p) : statSync(p).size;
    }
  } catch {}
  return total;
};
const finalSize = calcDirSize(WORKER_DIR);
console.log(`\n  📊 Final _worker.js size: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
if (finalSize > 25 * 1024 * 1024) {
  console.log(`  ⚠️  WARNING: Still over 25 MB limit!`);
} else {
  console.log(`  ✅ Under 25 MB limit!`);
}

console.log("\n✅ Prepared _worker.js directory for Cloudflare Pages");
