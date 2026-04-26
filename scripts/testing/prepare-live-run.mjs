import process from "node:process";
import { createManifest } from "./manifest-utils.mjs";

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

const runId = getArg("--run-id") || process.env.TEST_RUN_ID || "";
const environment = getArg("--environment") || process.env.TEST_ENVIRONMENT || "live";
const baseUrl = getArg("--base-url") || process.env.TEST_BASE_URL || "https://www.clalmobile.com";
const suite = getArg("--suite") || process.env.TEST_SUITE || "manual";
const actor = getArg("--actor") || process.env.TEST_ACTOR || "codex";

const { manifestPath, manifest } = await createManifest({
  runId,
  environment,
  baseUrl,
  suite,
  actor,
});

console.log("تم تجهيز جولة فحص حي/آمن جديدة");
console.log(`TEST_RUN_ID=${manifest.runId}`);
console.log(`TEST_MANIFEST_PATH=${manifestPath}`);
console.log("");
console.log("PowerShell:");
console.log(`$env:TEST_RUN_ID="${manifest.runId}"`);
console.log(`$env:TEST_MANIFEST_PATH="${manifestPath}"`);
