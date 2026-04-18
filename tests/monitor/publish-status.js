#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Write a concise status snapshot for the public status page.
 *
 * Called at the END of every monitor run (success or failure). Writes to:
 *   status.json  — latest snapshot
 *   history.json — last 168 snapshots (7 days × 24 hours)
 *
 * The `publish-status.yml` workflow commits these two files back to the
 * `status-page` branch so GitHub Pages serves them at:
 *   https://bawaya.github.io/ClalStore/status.json
 *   https://bawaya.github.io/ClalStore/history.json
 */

const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { URL } = require("node:url");

const BASE = process.env.STATUS_BASE_URL || "https://clalmobile.com";
const STATUS_PATH = process.env.STATUS_FILE || "status.json";
const HISTORY_PATH = process.env.STATUS_HISTORY_FILE || "history.json";
const HISTORY_MAX = 168;

async function timed(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const ms = Date.now() - start;
    return {
      status: res.ok ? "up" : res.status === 401 ? "gated" : "degraded",
      responseMs: ms,
      httpStatus: res.status,
    };
  } catch (err) {
    return { status: "down", responseMs: Date.now() - start, error: err.message };
  }
}

function sslDaysRemaining() {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(BASE);
      if (parsed.protocol !== "https:") return resolve(null);
      const socket = tls.connect(
        {
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : 443,
          servername: parsed.hostname,
          timeout: 10_000,
        },
        () => {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            socket.end();
            return resolve(null);
          }
          const daysLeft = Math.floor(
            (new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000,
          );
          socket.end();
          resolve(daysLeft);
        },
      );
      socket.on("error", () => resolve(null));
      socket.on("timeout", () => {
        socket.end();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function main() {
  const [website, api, store, settings, sslDays] = await Promise.all([
    timed("/"),
    timed("/api/health"),
    timed("/store"),
    timed("/api/settings/public"),
    sslDaysRemaining(),
  ]);

  const services = { website, api, store, "public-settings": settings };
  const anyDown = Object.values(services).some((s) => s.status === "down");
  const anyDegraded = Object.values(services).some((s) => s.status === "degraded");

  const snapshot = {
    lastCheck: new Date().toISOString(),
    status: anyDown ? "down" : anyDegraded ? "degraded" : "operational",
    services,
    ssl: sslDays !== null ? { valid: sslDays > 0, daysRemaining: sslDays } : null,
    commit: process.env.GITHUB_SHA || null,
    runUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
  };

  fs.writeFileSync(STATUS_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`[publish-status] wrote ${STATUS_PATH} — status=${snapshot.status}`);

  // Append to history (keep last N)
  let history = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
    } catch {
      history = [];
    }
  }
  history.push({
    t: snapshot.lastCheck,
    s: snapshot.status,
    r: {
      website: website.responseMs,
      api: api.responseMs,
      store: store.responseMs,
      settings: settings.responseMs,
    },
  });
  history = history.slice(-HISTORY_MAX);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log(`[publish-status] appended to ${HISTORY_PATH} — ${history.length} entries`);
}

main().catch((err) => {
  console.error("[publish-status] fatal:", err);
  process.exit(1);
});
