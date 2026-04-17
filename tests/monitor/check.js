/* eslint-disable no-console */
/**
 * Layer 5 — Hourly production monitor.
 *
 * Runs via GitHub Actions on a cron schedule (every hour).
 * Checks critical production endpoints and SSL cert validity.
 *
 * Exit code 0 = all good (no alert needed).
 * Exit code 1 = failure detected → workflow triggers alert.js
 */

const tls = require("node:tls");
const { URL } = require("node:url");

const BASE = process.env.MONITOR_URL || "https://clalmobile.com";
const MAX_RESPONSE_MS = 5000;
const SSL_WARN_DAYS = 14;

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name} ${detail}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`❌ ${name} ${detail}`);
}

async function checkEndpoint(name, path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const elapsed = Date.now() - start;
    if (res.status >= 200 && res.status < 400) {
      if (elapsed > MAX_RESPONSE_MS) {
        fail(name, `slow: ${elapsed}ms (${res.status})`);
      } else {
        pass(name, `${res.status} in ${elapsed}ms`);
      }
    } else {
      fail(name, `HTTP ${res.status} in ${elapsed}ms`);
    }
    return { ok: res.ok, status: res.status, elapsed };
  } catch (err) {
    fail(name, `error: ${err.message}`);
    return { ok: false, status: 0, elapsed: Date.now() - start };
  }
}

async function checkApiHealthStatus() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (res.status === 401) {
      // Endpoint is auth-protected — that's fine
      pass("api-health auth required", "401 (token-gated)");
      return;
    }
    if (!res.ok) {
      fail("api-health", `status ${res.status}`);
      return;
    }
    const body = await res.json();
    if (body?.data?.status === "healthy" || body?.data?.status === "degraded") {
      pass("api-health status", body.data.status);
    } else {
      fail("api-health status", `unexpected: ${JSON.stringify(body?.data?.status)}`);
    }
  } catch (err) {
    fail("api-health", `error: ${err.message}`);
  }
}

function checkSSL() {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(BASE);
      if (parsed.protocol !== "https:") {
        fail("ssl", "base URL is not https");
        return resolve();
      }
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
            fail("ssl", "no certificate");
            socket.end();
            return resolve();
          }
          const expires = new Date(cert.valid_to);
          const daysLeft = Math.floor((expires.getTime() - Date.now()) / 86_400_000);
          if (daysLeft < 0) {
            fail("ssl", `expired ${-daysLeft} days ago`);
          } else if (daysLeft < SSL_WARN_DAYS) {
            fail("ssl", `expires in ${daysLeft} days`);
          } else {
            pass("ssl", `${daysLeft} days remaining`);
          }
          socket.end();
          resolve();
        },
      );
      socket.on("error", (err) => {
        fail("ssl", `connect error: ${err.message}`);
        resolve();
      });
      socket.on("timeout", () => {
        fail("ssl", "connect timeout");
        socket.end();
        resolve();
      });
    } catch (err) {
      fail("ssl", `error: ${err.message}`);
      resolve();
    }
  });
}

async function main() {
  console.log(`🔍 Monitoring ${BASE}\n`);

  await Promise.all([
    checkEndpoint("homepage", "/"),
    checkEndpoint("public-settings", "/api/settings/public"),
    checkEndpoint("store", "/store"),
    checkApiHealthStatus(),
    checkSSL(),
  ]);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n📊 ${results.length - failed.length}/${results.length} checks passed`);

  if (failed.length > 0) {
    console.error(`\n🔴 ${failed.length} check(s) failed:`);
    failed.forEach((f) => console.error(`   • ${f.name}: ${f.detail}`));
    process.exit(1);
  }

  console.log("\n✅ All systems operational");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
