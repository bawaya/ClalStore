// Reads .env.local and rewrites postman/ClalMobile.local.postman_environment.json
// with non-destructive merge for id placeholders (keeps crmInboxId etc. if set).
// Run: node scripts/postman/sync-env.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const envPath = path.join(root, ".env.local");
const outPath = path.join(root, "postman/ClalMobile.local.postman_environment.json");

function parseEnvFile(p) {
  const o = {};
  if (!fs.existsSync(p)) {
    console.warn("Missing", p, "- nothing to import.");
    return o;
  }
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    o[k] = v;
  }
  return o;
}

function readExistingPostmanValues() {
  if (!fs.existsSync(outPath)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const m = {};
    for (const x of j.values || []) m[x.key] = x.value;
    return m;
  } catch {
    return {};
  }
}

const env = parseEnvFile(envPath);
const prev = readExistingPostmanValues();

const baseUrl =
  env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || prev.baseUrl || "http://localhost:3000";
const healthCheckToken = env.HEALTH_CHECK_TOKEN || prev.healthCheckToken || "";
const cronSecret = env.CRON_SECRET || prev.cronSecret || "";

const idKeys = [
  "sampleOrderId",
  "crmInboxId",
  "crmChatId",
  "crmCustomerId",
  "pipelineId",
  "salesDocId",
  "adminSalesRequestId",
  "adminCorrectionId",
  "adminOrderId",
  "customerOrderId",
  "employeeAnnouncementId",
  "employeeSalesRequestId",
  "pwaSaleId",
  "resourceId",
];

/** Non-empty defaults so Newman URLs never contain `//` (avoids 500/405 on wrong routes). */
const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_IDS = {
  sampleOrderId: "00000000-0000-0000-0000-000000000000",
  crmInboxId: PLACEHOLDER_UUID,
  crmChatId: PLACEHOLDER_UUID,
  crmCustomerId: PLACEHOLDER_UUID,
  pipelineId: PLACEHOLDER_UUID,
  salesDocId: PLACEHOLDER_UUID,
  adminSalesRequestId: PLACEHOLDER_UUID,
  adminCorrectionId: PLACEHOLDER_UUID,
  adminOrderId: PLACEHOLDER_UUID,
  customerOrderId: PLACEHOLDER_UUID,
  employeeAnnouncementId: "1",
  employeeSalesRequestId: PLACEHOLDER_UUID,
  pwaSaleId: PLACEHOLDER_UUID,
  resourceId: PLACEHOLDER_UUID,
};

const values = [
  { key: "baseUrl", value: baseUrl, type: "default", enabled: true },
  { key: "healthCheckToken", value: healthCheckToken, type: "secret", enabled: true },
  { key: "cronSecret", value: cronSecret, type: "secret", enabled: true },
];

for (const k of idKeys) {
  const fallback = DEFAULT_IDS[k] ?? "";
  values.push({
    key: k,
    value: prev[k] != null && prev[k] !== "" ? prev[k] : fallback,
    type: "default",
    enabled: true,
  });
}

const out = {
  id: "clalmobile-local-001",
  name: "ClalMobile — Local / Dev (synced from .env.local)",
  values,
  _postman_variable_scope: "environment",
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log("Updated", outPath, "from", envPath);
console.log("  baseUrl: set  |  healthCheckToken:", healthCheckToken ? "(set)" : "(empty - add HEALTH_CHECK_TOKEN in .env.local)");
console.log("  cronSecret:", cronSecret ? "(set)" : "(empty - add CRON_SECRET in .env.local)");
