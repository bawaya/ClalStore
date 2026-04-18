#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Alert deduplication + escalation gateway.
 *
 * Called by smoke / monitor / synthetic workflows on failure. Uses GitHub
 * Issues as the state store to avoid sending 48 identical WhatsApp / email
 * alerts for the same ongoing outage.
 *
 * Logic:
 *   1. Look for an open issue labelled `alert:active` + the given SOURCE.
 *   2. If none exists:
 *        - Create it
 *        - Send WhatsApp + email (first failure — we want to know fast)
 *   3. If one exists:
 *        - Append a comment with the new timestamp + workflow run URL
 *        - Only send alerts if >= 2 hours have passed since last notify
 *          (escalation: "still broken" poke every 2h, not 60× a day)
 *   4. When a subsequent run succeeds, the issue is auto-closed by a
 *      recovery workflow that calls this script with `--recover`.
 *
 * Required env:
 *   GITHUB_TOKEN        (supplied automatically in Actions)
 *   GITHUB_REPOSITORY   "owner/repo"
 *   ALERT_SOURCE        "smoke" | "monitor" | "synthetic"
 *   YCLOUD_API_KEY, ALERT_WHATSAPP, WHATSAPP_PHONE_ID — WhatsApp notify
 *   RESEND_API_KEY, ALERT_EMAIL, RESEND_FROM          — email notify
 *   GITHUB_SERVER_URL, GITHUB_RUN_ID                  — run link in message
 *
 * Flags:
 *   --recover           send a recovery notification, close active issue
 */

const https = require("node:https");

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;
const SOURCE = process.env.ALERT_SOURCE || "monitor";
const RECOVER = process.argv.includes("--recover");

const NOTIFY_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

function gh(method, path, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : undefined;
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          "User-Agent": "clalmobile-alert-dedup",
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`GitHub ${method} ${path} → ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          resolve(data ? JSON.parse(data) : null);
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function findActiveIssue() {
  const issues = await gh(
    "GET",
    `/repos/${REPO}/issues?state=open&labels=alert:active,source:${SOURCE}&per_page=1`,
  );
  return issues && issues.length ? issues[0] : null;
}

async function createIssue(runUrl) {
  return gh("POST", `/repos/${REPO}/issues`, {
    title: `🔴 [${SOURCE}] Production alert — ${new Date().toISOString()}`,
    body: [
      `**Source:** ${SOURCE}`,
      `**First failure:** ${new Date().toISOString()}`,
      `**Workflow:** ${runUrl}`,
      "",
      "This issue auto-closes when the next scheduled run of the same workflow succeeds.",
      "",
      "_Created by `tests/monitor/alert-dedup.js`._",
    ].join("\n"),
    labels: ["alert:active", `source:${SOURCE}`, "automated"],
  });
}

async function addComment(issueNumber, runUrl) {
  return gh("POST", `/repos/${REPO}/issues/${issueNumber}/comments`, {
    body: `Still failing at ${new Date().toISOString()} — ${runUrl}`,
  });
}

async function closeIssue(issueNumber) {
  return gh("PATCH", `/repos/${REPO}/issues/${issueNumber}`, {
    state: "closed",
    state_reason: "completed",
  });
}

function runUrl() {
  if (process.env.GITHUB_SERVER_URL && REPO && process.env.GITHUB_RUN_ID) {
    return `${process.env.GITHUB_SERVER_URL}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  }
  return "";
}

async function sendWhatsApp(message) {
  const key = process.env.YCLOUD_API_KEY;
  const to = process.env.ALERT_WHATSAPP;
  if (!key || !to) return;
  try {
    const body = JSON.stringify({
      from: process.env.WHATSAPP_PHONE_ID || undefined,
      to,
      type: "text",
      text: { body: message },
    });
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body,
    });
    console.log(`[alert-dedup] WhatsApp → ${res.status}`);
  } catch (err) {
    console.error("[alert-dedup] WhatsApp failed:", err.message);
  }
}

async function sendEmail(subject, text) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  const from = process.env.RESEND_FROM || "ClalMobile Alerts <alerts@clalmobile.com>";
  if (!key || !to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    console.log(`[alert-dedup] Email → ${res.status}`);
  } catch (err) {
    console.error("[alert-dedup] Email failed:", err.message);
  }
}

async function main() {
  if (!TOKEN || !REPO) {
    console.error("[alert-dedup] GITHUB_TOKEN and GITHUB_REPOSITORY are required");
    process.exit(1);
  }

  const url = runUrl();
  const existing = await findActiveIssue();

  if (RECOVER) {
    if (!existing) {
      console.log("[alert-dedup] no active alert to recover");
      return;
    }
    await closeIssue(existing.number);
    console.log(`[alert-dedup] closed issue #${existing.number}`);
    await Promise.all([
      sendWhatsApp(`✅ ClalMobile [${SOURCE}] recovered at ${new Date().toISOString()}. Last alert resolved.`),
      sendEmail(
        `✅ ClalMobile [${SOURCE}] recovered`,
        `The ${SOURCE} workflow just succeeded. Last failing run was ongoing since the issue was opened.\n\n${url}`,
      ),
    ]);
    return;
  }

  if (!existing) {
    const issue = await createIssue(url);
    console.log(`[alert-dedup] created issue #${issue.number}`);
    await Promise.all([
      sendWhatsApp(`🔴 ClalMobile [${SOURCE}] FAIL at ${new Date().toISOString()}\n${url}`),
      sendEmail(
        `🔴 ClalMobile [${SOURCE}] alert — first failure`,
        `The ${SOURCE} workflow just failed. Check ${url}`,
      ),
    ]);
    return;
  }

  // Existing active issue — throttle outbound notifications
  const lastComment = existing.updated_at || existing.created_at;
  const ageMs = Date.now() - new Date(lastComment).getTime();

  await addComment(existing.number, url);
  console.log(`[alert-dedup] appended comment to issue #${existing.number} (age ${Math.round(ageMs / 60_000)}m)`);

  if (ageMs >= NOTIFY_COOLDOWN_MS) {
    await Promise.all([
      sendWhatsApp(`🔴 ClalMobile [${SOURCE}] still failing (${Math.round(ageMs / 3_600_000)}h open)\n${url}`),
      sendEmail(
        `🔴 ClalMobile [${SOURCE}] still failing`,
        `Still broken after ${Math.round(ageMs / 3_600_000)} hours. ${url}`,
      ),
    ]);
  } else {
    console.log("[alert-dedup] within cooldown — no outbound notification");
  }
}

main().catch((err) => {
  console.error("[alert-dedup] fatal:", err);
  process.exit(1);
});
