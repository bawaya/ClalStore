// Runs Postman collection folders in technical order, fail-fast.
// Each folder runs in its own newman invocation so we keep per-folder reporting,
// while a shared --cookie-jar carries the admin session from Y-Auth-Setup
// through to the admin/CRM/etc folders.
//
// Requires: `npm run dev` (or `npm start`) and an env file with the credentials
// at postman/ClalMobile.local.postman_environment.json.
// Usage:    node scripts/postman/run-layers.mjs
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const collection = path.join(root, "postman/ClalMobile-API-Layers.postman_collection.json");
const env = path.join(root, "postman/ClalMobile.local.postman_environment.json");

// Y-Auth-Setup runs first so its login response writes the Supabase auth cookies
// into the shared jar; subsequent folders inherit the session via the jar.
const FOLDERS = [
  "Y-Auth-Setup",
  "0-Smoke-Public",
  "1-Store-Read-Model",
  "2-Commerce-Messaging-Orders",
  "3-Customer-Auth-GDPR",
  "4-CRM",
  "5-Admin",
  "6-Employee-SalesPWA",
  "7-Integrations-Ops",
];

const cookieJar = path.join(root, "tmp/newman-cookies.jar");
fs.mkdirSync(path.dirname(cookieJar), { recursive: true });
// Start fresh with a valid empty tough-cookie jar so a stale session can't mask
// login failures. Newman refuses to start if --cookie-jar points at a missing
// path or invalid JSON.
fs.writeFileSync(
  cookieJar,
  JSON.stringify({
    version: "tough-cookie@4.1.4",
    storeType: "MemoryCookieStore",
    rejectPublicSuffixes: true,
    cookies: [],
  }),
);

const baseArgs = [
  "newman",
  "run",
  collection,
  "-e",
  env,
  "--delay-request",
  "100",
  "--color",
  "on",
  "--cookie-jar",
  cookieJar,
  "--export-cookie-jar",
  cookieJar,
];

for (const folder of FOLDERS) {
  console.log(`\n========== ${folder} ==========\n`);
  const r = spawnSync("npx", [...baseArgs, "--folder", folder], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  if (r.status !== 0) {
    console.error(`\n[run-layers] Stopped: folder "${folder}" exited with code ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
}

console.log("\n[run-layers] All folders passed.\n");
