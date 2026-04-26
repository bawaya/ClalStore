import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const LIVE_RUNS_DIR = path.join(process.cwd(), ".tmp", "live-test-runs");

export function createRunId(prefix = "live") {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${random}`;
}

export async function ensureLiveRunsDir() {
  await fs.mkdir(LIVE_RUNS_DIR, { recursive: true });
  return LIVE_RUNS_DIR;
}

export function normalizeManifestPath(input) {
  if (!input) return "";
  return path.isAbsolute(input) ? input : path.join(process.cwd(), input);
}

export function buildManifestPath(runId) {
  return path.join(LIVE_RUNS_DIR, `${runId}.json`);
}

export async function createManifest({
  runId,
  environment = "live",
  baseUrl = "https://www.clalmobile.com",
  suite = "manual",
  actor = "codex",
  notes = [],
} = {}) {
  const effectiveRunId = runId || createRunId();
  await ensureLiveRunsDir();
  const manifestPath = buildManifestPath(effectiveRunId);
  const manifest = {
    version: 1,
    runId: effectiveRunId,
    environment,
    baseUrl,
    suite,
    actor,
    createdAt: new Date().toISOString(),
    notes,
    artifacts: [],
    cleanup: null,
  };
  await writeManifest(manifestPath, manifest);
  return { manifestPath, manifest };
}

export async function readManifest(manifestPath) {
  const resolved = normalizeManifestPath(manifestPath);
  const raw = await fs.readFile(resolved, "utf8");
  return JSON.parse(raw);
}

export async function writeManifest(manifestPath, manifest) {
  const resolved = normalizeManifestPath(manifestPath);
  await ensureLiveRunsDir();
  await fs.writeFile(resolved, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function recordArtifact(manifestPath, artifact) {
  const manifest = await readManifest(manifestPath);
  manifest.artifacts.push({
    id: `${manifest.runId}_${manifest.artifacts.length + 1}`,
    recordedAt: new Date().toISOString(),
    ...artifact,
  });
  await writeManifest(manifestPath, manifest);
  return manifest.artifacts.at(-1);
}

export async function updateCleanupReport(manifestPath, cleanup) {
  const manifest = await readManifest(manifestPath);
  manifest.cleanup = cleanup;
  await writeManifest(manifestPath, manifest);
  return manifest;
}
