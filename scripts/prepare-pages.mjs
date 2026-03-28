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
 * This script copies the worker + server dirs into assets/_worker.js/ so Pages can serve them,
 * then strips files that are already inlined in handler.mjs or not needed at runtime to keep
 * the Pages Functions bundle under the 25 MiB limit.
 */

import {
  cpSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const OPEN_NEXT = ".open-next";
const WORKER_DIR = join(OPEN_NEXT, "assets", "_worker.js");

// Clean previous build
if (existsSync(WORKER_DIR)) {
  rmSync(WORKER_DIR, { recursive: true, force: true });
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

// ── Trim files that bloat the bundle ──────────────────────────────────────
// esbuild already inlined these into handler.mjs, so the node_modules copies
// are dead weight that Wrangler would re-bundle, pushing us over 25 MiB.

const NM = join(
  WORKER_DIR,
  "server-functions",
  "default",
  "node_modules",
);

const NEXT_DIST = join(NM, "next", "dist");

/** Paths to remove – relative to the _worker.js root. */
const removals = [
  // Client-only packages already inlined in handler.mjs by esbuild
  join(NM, "xlsx"),
  join(NM, "pdfjs-dist"),
  // Large font-metrics JSON (4.2 MB) – never loaded by handler.mjs
  join(NEXT_DIST, "server", "capsize-font-metrics.json"),
  // Dev-only server code – not needed in production
  join(NEXT_DIST, "server", "dev"),
  // Edge-runtime shim already aliased to empty by esbuild
  join(NEXT_DIST, "compiled", "edge-runtime"),
  // Compression – Cloudflare handles this at the CDN layer
  join(NEXT_DIST, "compiled", "compression"),
  // TypeScript checker – not needed at runtime
  join(NEXT_DIST, "server", "typescript"),
  // CLI files – not needed at runtime
  join(NEXT_DIST, "cli"),
  // Telemetry – not needed at runtime
  join(NEXT_DIST, "telemetry"),
  // Node.js OG renderer – Cloudflare uses the edge version
  join(NEXT_DIST, "compiled", "@vercel", "og", "index.node.js"),
  // Experimental turbo runtime – not used unless experimental React is enabled
  join(
    NEXT_DIST,
    "compiled",
    "next-server",
    "app-page-turbo-experimental.runtime.prod.js",
  ),
  // MCP server – not needed at runtime
  join(NEXT_DIST, "server", "mcp"),
  // Trace utility – not needed at runtime
  join(NEXT_DIST, "trace"),
  // Export utility – not needed at runtime
  join(NEXT_DIST, "export"),
  // esbuild metafile – debugging only, not needed at runtime
  join(
    WORKER_DIR,
    "server-functions",
    "default",
    "handler.mjs.meta.json",
  ),
];

let totalSaved = 0;
for (const p of removals) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`  🗑️  Removed ${p}`);
  }
}

// ── _routes.json so static assets bypass the Worker ──────────────────────
const routesJson = {
  version: 1,
  include: ["/*"],
  exclude: [
    "/_next/static/*",
    "/icons/*",
    "/manifest.json",
    "/sw.js",
    "/pdf.worker.min.mjs",
    "/BUILD_ID",
  ],
};

writeFileSync(
  join(OPEN_NEXT, "assets", "_routes.json"),
  JSON.stringify(routesJson, null, 2),
  "utf-8",
);

console.log("✅ Prepared _worker.js directory for Cloudflare Pages");
