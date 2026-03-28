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

import { cpSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
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

console.log("✅ Prepared _worker.js directory for Cloudflare Pages");
