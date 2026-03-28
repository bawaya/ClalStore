/**
 * Prepare OpenNext output for Cloudflare Pages deployment.
 *
 * Cloudflare Pages expects a `_worker.js/` directory inside the output dir
 * with `index.js` as entry point + all server modules alongside it.
 *
 * OpenNext outputs:
 *   .open-next/worker.js          <- entry point
 *   .open-next/cloudflare/        <- runtime helpers
 *   .open-next/middleware/         <- middleware handler
 *   .open-next/server-functions/   <- route handlers
 *   .open-next/.build/            <- durable objects
 *   .open-next/cache/             <- cache adaptor
 *   .open-next/cloudflare-templates/
 *   .open-next/dynamodb-provider/
 *   .open-next/assets/            <- static files (Pages output dir)
 *
 * This script copies the worker + server dirs into assets/_worker.js/ so Pages
 * can serve them, then aggressively strips files that are NOT referenced by
 * handler.mjs to keep the Pages Functions bundle under the 25 MiB limit.
 */

import {
  cpSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
  lstatSync,
  readFileSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join, relative } from "node:path";

const OPEN_NEXT = ".open-next";
const WORKER_DIR = join(OPEN_NEXT, "assets", "_worker.js");

// ── Step 1: Copy worker structure ────────────────────────────────────────

if (existsSync(WORKER_DIR)) {
  rmSync(WORKER_DIR, { recursive: true, force: true });
}
mkdirSync(WORKER_DIR, { recursive: true });

copyFileSync(join(OPEN_NEXT, "worker.js"), join(WORKER_DIR, "index.js"));

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

// ── Step 2: Analyse handler.mjs to find referenced node_modules paths ────

const SF_DEFAULT = join(WORKER_DIR, "server-functions", "default");
const NM = join(SF_DEFAULT, "node_modules");
const NEXT_DIST = join(NM, "next", "dist");

const handlerPath = join(SF_DEFAULT, "handler.mjs");
const handlerCode = readFileSync(handlerPath, "utf-8");

// Extract all next/dist/* paths referenced in handler.mjs
const nextDistRefs = new Set();
const refRegex = /node_modules\/next\/dist\/([^"'\s,;)]+)/g;
let m;
while ((m = refRegex.exec(handlerCode)) !== null) {
  nextDistRefs.add(m[1].replace(/ <module evaluation>$/, ""));
}

console.log(`  Found ${nextDistRefs.size} next/dist references in handler.mjs`);

// ── Step 3: Aggressive removals ──────────────────────────────────────────

/** Remove a path and log it with its size */
function rm(p, label) {
  if (!existsSync(p)) return 0;
  let size = 0;
  try {
    const stat = statSync(p);
    if (stat.isDirectory()) {
      size = parseInt(
        execSync(`du -sb "${p}" 2>/dev/null`).toString().split("\t")[0],
        10,
      );
    } else {
      size = stat.size;
    }
  } catch {}
  rmSync(p, { recursive: true, force: true });
  const kb = Math.round(size / 1024);
  console.log(`  🗑️  ${label || relative(".", p)} (${kb} KB)`);
  return size;
}

/**
 * Walk a directory tree and remove files not in the needed set.
 * Empty directories are cleaned up automatically.
 */
function walkAndPrune(dir, relBase, prefix, neededFiles) {
  if (!existsSync(dir)) return 0;
  let saved = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relBase ? `${relBase}/${entry}` : entry;
    const lst = lstatSync(full);
    if (lst.isSymbolicLink()) {
      // Remove all symlinks in pruned dirs — they aren't needed at runtime
      saved += rm(full, `${prefix}/${rel}`);
    } else if (lst.isDirectory()) {
      saved += walkAndPrune(full, rel, prefix, neededFiles);
      try {
        if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
      } catch {}
    } else {
      const distRel = `${prefix}/${rel}`;
      if (!neededFiles.has(distRel)) {
        saved += rm(full, `${prefix}/${rel}`);
      }
    }
  }
  return saved;
}

let totalSaved = 0;

// 3a. Remove non-Next packages already inlined by esbuild
for (const pkg of ["xlsx", "pdfjs-dist"]) {
  totalSaved += rm(join(NM, pkg), `node_modules/${pkg}`);
}

// 3b. Remove handler.mjs.meta.json (debug only)
totalSaved += rm(join(SF_DEFAULT, "handler.mjs.meta.json"), "handler.mjs.meta.json");

// 3c. Remove Next.js compiled packages NOT referenced by handler.mjs
const NEEDED_COMPILED = new Set([
  "@edge-runtime",
  "@mswjs",
  "@opentelemetry",
  "@vercel",
  "bytes",
  "cookie",
  "fresh",
  "jsonwebtoken",
  "next-server",
  "p-queue",
  "path-to-regexp",
  "string-hash",
  "ua-parser-js",
]);

const compiledDir = join(NEXT_DIST, "compiled");
if (existsSync(compiledDir)) {
  for (const entry of readdirSync(compiledDir)) {
    if (!NEEDED_COMPILED.has(entry)) {
      totalSaved += rm(join(compiledDir, entry), `compiled/${entry}`);
    }
  }
}

// 3d. Within needed compiled packages, remove files we don't need
// @vercel/og: remove Node.js renderer + LICENSE files (if present)
for (const f of [
  join(compiledDir, "@vercel", "og", "index.node.js"),
  join(compiledDir, "@vercel", "og", "LICENSE"),
  join(compiledDir, "@vercel", "og", "satori", "LICENSE"),
]) {
  totalSaved += rm(f, relative(compiledDir, f));
}

// next-server: remove experimental + pages runtimes
totalSaved += rm(
  join(compiledDir, "next-server", "app-page-turbo-experimental.runtime.prod.js"),
  "next-server/experimental runtime",
);
totalSaved += rm(
  join(compiledDir, "next-server", "pages-turbo.runtime.prod.js"),
  "next-server/pages runtime",
);

// @edge-runtime: remove primitives (Workers have native primitives)
totalSaved += rm(
  join(compiledDir, "@edge-runtime", "primitives"),
  "@edge-runtime/primitives",
);

// 3e. Remove entire Next.js dist directories not needed at runtime
for (const dir of ["cli", "telemetry", "trace", "export"]) {
  totalSaved += rm(join(NEXT_DIST, dir), `next/dist/${dir}`);
}

// 3f. Remove specific large server files not referenced by handler
for (const file of [
  "capsize-font-metrics.json",
  "image-optimizer.js",
  "config-schema.js",
  "config.js",
  "render.js",
]) {
  const p = join(NEXT_DIST, "server", file);
  if (existsSync(p) && !nextDistRefs.has(`server/${file}`)) {
    totalSaved += rm(p, `server/${file}`);
  }
}

// 3g. Remove server subdirs not needed at runtime
for (const dir of ["dev", "typescript", "mcp"]) {
  totalSaved += rm(join(NEXT_DIST, "server", dir), `server/${dir}`);
}

// 3h. Remove build/ files not referenced by handler
const buildDir = join(NEXT_DIST, "build");
if (existsSync(buildDir)) {
  const neededBuildFiles = new Set();
  for (const ref of nextDistRefs) {
    if (ref.startsWith("build/")) neededBuildFiles.add(ref);
  }
  totalSaved += walkAndPrune(buildDir, "", "build", neededBuildFiles);
}

// 3i. Remove client/ files not referenced by handler
const clientDir = join(NEXT_DIST, "client");
if (existsSync(clientDir)) {
  const neededClientFiles = new Set();
  for (const ref of nextDistRefs) {
    if (ref.startsWith("client/")) neededClientFiles.add(ref);
  }
  totalSaved += walkAndPrune(clientDir, "", "client", neededClientFiles);
}

// 3j. Remove lib/ files not referenced by handler
const libDir = join(NEXT_DIST, "lib");
if (existsSync(libDir)) {
  const neededLibFiles = new Set();
  for (const ref of nextDistRefs) {
    if (ref.startsWith("lib/")) neededLibFiles.add(ref);
  }
  totalSaved += walkAndPrune(libDir, "", "lib", neededLibFiles);
}

// 3k. Remove shared/ files not referenced by handler
const sharedDir = join(NEXT_DIST, "shared");
if (existsSync(sharedDir)) {
  const neededSharedFiles = new Set();
  for (const ref of nextDistRefs) {
    if (ref.startsWith("shared/")) neededSharedFiles.add(ref);
  }
  totalSaved += walkAndPrune(sharedDir, "", "shared", neededSharedFiles);
}

console.log(
  `\n  Total trimmed: ${(totalSaved / 1024 / 1024).toFixed(1)} MiB`,
);

// ── Step 4: Remove broken symlinks left after pruning ────────────────────
// cpSync preserves symlinks from node_modules; pruning may remove their
// targets, leaving dangling links that Cloudflare Pages rejects.

function removeBrokenSymlinks(dir) {
  let removed = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const lst = lstatSync(full);
    if (lst.isSymbolicLink()) {
      // Check if target exists (statSync follows the link and throws if broken)
      try {
        statSync(full);
      } catch (err) {
        if (err.code === "ENOENT" || err.code === "ELOOP") {
          rmSync(full, { force: true });
          console.log(`  🔗 Removed broken symlink: ${relative(".", full)}`);
          removed++;
        }
      }
    } else if (lst.isDirectory()) {
      removed += removeBrokenSymlinks(full);
      // Clean up empty dirs
      try {
        if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
      } catch {}
    }
  }
  return removed;
}

const brokenCount = removeBrokenSymlinks(WORKER_DIR);
if (brokenCount > 0) {
  console.log(`  Removed ${brokenCount} broken symlink(s)`);
}

// ── Step 5: _routes.json so static assets bypass the Worker ──────────────

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
