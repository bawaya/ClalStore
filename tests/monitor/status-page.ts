/**
 * Layer 5 companion — builds a static status page JSON.
 * Optionally invoked after each successful monitor run to update a status file
 * in the repo that a lightweight status page can render.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

interface ServiceStatus {
  status: "up" | "down" | "degraded";
  responseTime: number;
}

interface StatusSnapshot {
  lastCheck: string;
  status: "operational" | "degraded" | "down";
  services: Record<string, ServiceStatus>;
  ssl: { valid: boolean; expiresIn: number };
}

const BASE = process.env.MONITOR_URL || "https://clalmobile.com";

async function timed(path: string): Promise<ServiceStatus> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - start;
    return { status: res.ok ? "up" : "degraded", responseTime: elapsed };
  } catch {
    return { status: "down", responseTime: Date.now() - start };
  }
}

async function main() {
  const [website, api, store, publicSettings] = await Promise.all([
    timed("/"),
    timed("/api/health"),
    timed("/store"),
    timed("/api/settings/public"),
  ]);

  const allUp = [website, api, store, publicSettings].every((s) => s.status === "up");
  const anyDown = [website, api, store, publicSettings].some((s) => s.status === "down");

  const snapshot: StatusSnapshot = {
    lastCheck: new Date().toISOString(),
    status: anyDown ? "down" : allUp ? "operational" : "degraded",
    services: {
      website,
      api,
      store,
      "public-settings": publicSettings,
    },
    ssl: { valid: true, expiresIn: 0 }, // populated separately by monitor/check.js if needed
  };

  const outPath = join(process.cwd(), "status.json");
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`📄 Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
