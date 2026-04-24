// Runs Postman collection folders L0–L7 in technical order (sequential, fail-fast).
// Requires: `npm run dev` (or `npm start`) and optional env in postman/ClalMobile.local.postman_environment.json
// Usage: node scripts/postman/run-layers.mjs
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const collection = path.join(root, "postman/ClalMobile-API-Layers.postman_collection.json");
const env = path.join(root, "postman/ClalMobile.local.postman_environment.json");

const FOLDERS = [
  "0-Smoke-Public",
  "1-Store-Read-Model",
  "2-Commerce-Messaging-Orders",
  "3-Customer-Auth-GDPR",
  "4-CRM",
  "5-Admin",
  "6-Employee-SalesPWA",
  "7-Integrations-Ops",
];

// Small delay between requests (optional; middleware skips generic api RL in development).
const args = ["newman", "run", collection, "-e", env, "--delay-request", "100", "--color", "on"];

let failed = 0;
for (const folder of FOLDERS) {
  console.log(`\n========== ${folder} ==========\n`);
  const r = spawnSync("npx", [...args, "--folder", folder], {
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
console.log("\n[run-layers] All layers L0–L7 passed.\n");
