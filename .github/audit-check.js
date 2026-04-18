#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Compare npm audit output against an allowlist of known-accepted vulns.
 *
 * Exits:
 *   0 — all HIGH/CRITICAL are either fixed or covered by an unexpired allowlist entry
 *   1 — at least one HIGH/CRITICAL is not in the allowlist, OR an allowlist entry
 *       expired. GitHub Actions step summary gets the details.
 */

const fs = require("node:fs");

const AUDIT_JSON = process.env.AUDIT_JSON || "audit.json";
const ALLOWLIST = process.env.ALLOWLIST || ".github/audit-allowlist.json";
const SUMMARY = process.env.GITHUB_STEP_SUMMARY || null;

function writeSummary(lines) {
  const block = lines.join("\n");
  console.log(block);
  if (SUMMARY) fs.appendFileSync(SUMMARY, block + "\n");
}

const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, "utf8"));
const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, "utf8"));

const now = new Date();
const allowed = new Map();
for (const entry of allowlist.allowed || []) {
  if (entry.expires) {
    const exp = new Date(entry.expires);
    if (exp < now) {
      writeSummary([
        `### ❌ Audit allowlist entry EXPIRED`,
        ``,
        `- **${entry.package}** (${entry.severity}) — expired ${entry.expires}`,
        `- Reason: ${entry.reason}`,
        ``,
        `Renew the expiry date in \`.github/audit-allowlist.json\` or upgrade the package.`,
      ]);
      process.exit(1);
    }
  }
  allowed.set(entry.package, entry);
}

const vulns = audit.vulnerabilities || {};
const highOrCritical = Object.entries(vulns).filter(
  ([, v]) => v.severity === "high" || v.severity === "critical",
);

if (highOrCritical.length === 0) {
  writeSummary(["### ✅ npm audit: no HIGH or CRITICAL issues"]);
  process.exit(0);
}

const unhandled = [];
const handled = [];

for (const [name, v] of highOrCritical) {
  const entry = allowed.get(name);
  if (entry) {
    handled.push({ name, severity: v.severity, reason: entry.reason, expires: entry.expires });
  } else {
    unhandled.push({ name, severity: v.severity, via: v.via });
  }
}

const lines = [];

if (handled.length > 0) {
  lines.push("### ⚠️  Known-accepted HIGH/CRITICAL (allowlisted)");
  lines.push("");
  for (const h of handled) {
    lines.push(`- **${h.name}** (${h.severity}) — expires \`${h.expires}\``);
    lines.push(`  Reason: ${h.reason}`);
  }
  lines.push("");
}

if (unhandled.length > 0) {
  lines.push("### ❌ New HIGH/CRITICAL vulnerabilities (NOT in allowlist)");
  lines.push("");
  for (const u of unhandled) {
    const advisories = (u.via || [])
      .map((x) => (typeof x === "string" ? x : x.title || x.name))
      .filter(Boolean)
      .join("; ");
    lines.push(`- **${u.name}** (${u.severity}): ${advisories || "see npm audit output"}`);
  }
  lines.push("");
  lines.push("Fix options:");
  lines.push("1. Run `npm audit fix` if an upstream fix exists");
  lines.push("2. Upgrade or replace the package");
  lines.push("3. If truly unfixable, add an entry to `.github/audit-allowlist.json`");
  writeSummary(lines);
  process.exit(1);
}

writeSummary(lines.concat(["### ✅ All HIGH/CRITICAL vulns are allowlisted"]));
process.exit(0);
