#!/usr/bin/env node
/**
 * prepare-pages.mjs — stub that unblocks legacy Cloudflare Pages builds.
 *
 * We deploy ClalMobile through Cloudflare **Workers** (via OpenNext's
 * `worker.js` output), NOT through Cloudflare Pages. However, an older
 * Cloudflare Pages project in the account is still connected to this repo
 * and auto-builds on every push with the build command:
 *
 *   npx opennextjs-cloudflare build && node scripts/prepare-pages.mjs
 *
 * Without this file, those legacy Pages builds crashed with:
 *
 *   Error: Cannot find module '/opt/buildhome/repo/scripts/prepare-pages.mjs'
 *
 * This script does the minimal work to let that legacy build complete
 * cleanly — it copies the OpenNext-produced static assets into the
 * conventional `dist/` directory that Cloudflare Pages expects. It does
 * NOT set up a working Pages deployment; the app will still misbehave
 * on Pages because OpenNext targets Workers, not Pages. If you want to
 * fully stop those builds, delete the Pages project from the Cloudflare
 * dashboard (see docs/OPERATIONS.md).
 *
 * Run manually:
 *   node scripts/prepare-pages.mjs
 */

import { existsSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OPEN_NEXT_ASSETS = join(ROOT, ".open-next/assets");
const OUT_DIR = join(ROOT, "dist");

console.log("[prepare-pages] legacy Cloudflare Pages shim — we deploy via Workers");

// Create dist/ if missing so the Pages build has something to upload
mkdirSync(OUT_DIR, { recursive: true });

// If OpenNext produced static assets, mirror them into dist/. The Pages
// deployment will at least show product images / favicons correctly even
// though the serverless handlers won't work (they need Workers).
if (existsSync(OPEN_NEXT_ASSETS)) {
  cpSync(OPEN_NEXT_ASSETS, OUT_DIR, { recursive: true, force: true });
  console.log(`[prepare-pages] copied ${OPEN_NEXT_ASSETS} → ${OUT_DIR}`);
} else {
  // Nothing to copy — write a minimal index.html so Pages doesn't try to
  // deploy an empty directory.
  writeFileSync(
    join(OUT_DIR, "index.html"),
    [
      "<!doctype html>",
      "<meta charset=\"utf-8\" />",
      "<title>ClalMobile — moved</title>",
      "<meta http-equiv=\"refresh\" content=\"0; url=https://clalmobile.com\" />",
      "<p>Production is served from the Cloudflare Worker. If you landed here, you probably hit the legacy Pages project by accident.</p>",
      "<p><a href=\"https://clalmobile.com\">Go to clalmobile.com →</a></p>",
    ].join("\n"),
  );
  console.log("[prepare-pages] no .open-next/assets — wrote a redirect stub into dist/");
}

console.log("[prepare-pages] done");
