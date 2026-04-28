// =====================================================
// Outbound message mock store — append-only JSONL log
// of every email/SMS/WhatsApp call that the guard
// intercepted. Used by tests and local dev to inspect
// what would have been sent in production.
//
// One file per UTC day under logs/outbound/, e.g.
//   logs/outbound/2026-04-28.jsonl
// Override the directory with MOCK_OUTBOUND_LOG_DIR for
// tests that need a temp directory.
// =====================================================

import { promises as fs } from "node:fs";
import path from "node:path";

import type { OutboundChannel, OutboundGuardResult } from "./outbound-guard";

export interface OutboundMockEntry {
  /** ISO timestamp of when the send was intercepted. */
  ts: string;
  channel: OutboundChannel;
  /** Stable reason from the guard so tests can assert on the cause. */
  reason: NonNullable<OutboundGuardResult["reason"]>;
  /** Channel-specific recipient — email address, phone number, etc. */
  to: string;
  /** Subject for email; null for SMS/WhatsApp. */
  subject: string | null;
  /** Truncated body preview. Full body lives in `meta.body` if needed. */
  bodyPreview: string;
  /** Optional structured metadata (template name, params, …). */
  meta?: Record<string, unknown>;
}

const DEFAULT_DIR = path.join(process.cwd(), "logs", "outbound");
const MAX_PREVIEW_LEN = 500;

function logDir(): string {
  return process.env.MOCK_OUTBOUND_LOG_DIR?.trim() || DEFAULT_DIR;
}

function todayFile(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return path.join(logDir(), `${yyyy}-${mm}-${dd}.jsonl`);
}

function truncate(text: string | undefined): string {
  if (!text) return "";
  return text.length <= MAX_PREVIEW_LEN
    ? text
    : `${text.slice(0, MAX_PREVIEW_LEN)}…[truncated]`;
}

/**
 * Mask a phone number for console output: keep the first 5 chars (e.g.
 * "+9725") and the last 4, replace the middle with stars. JSONL keeps the
 * full number for test assertions; this helper is only used by the
 * console signal so a screen-share or shoulder-surfer can't read a
 * customer phone.
 */
export function maskPhone(phone: string | undefined): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.length <= 9) {
    // Too short for meaningful masking — keep prefix + last 2.
    return trimmed.length <= 5
      ? trimmed
      : `${trimmed.slice(0, trimmed.length - 2)}**`;
  }
  return `${trimmed.slice(0, 5)}****${trimmed.slice(-4)}`;
}

/**
 * Append a mock entry to today's JSONL file. Always returns a result the
 * caller can return to its own caller — never throws — so a logging
 * failure never breaks application flow.
 */
export async function recordMockOutbound(entry: Omit<OutboundMockEntry, "ts">): Promise<{
  success: true;
  mocked: true;
  reason: OutboundMockEntry["reason"];
}> {
  const full: OutboundMockEntry = {
    ts: new Date().toISOString(),
    ...entry,
    bodyPreview: truncate(entry.bodyPreview),
  };

  const file = todayFile();
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${JSON.stringify(full)}\n`, "utf8");
    // Single-line console signal so a developer skimming the dev server
    // log immediately knows a message was caught instead of sent. The full
    // recipient is preserved in the JSONL above; the console gets a masked
    // version for sms/whatsapp channels (real phone numbers) so a
    // screen-share can't leak a customer phone. Email and whatsapp_template
    // recipients (an address and a template name respectively) are not
    // sensitive in the same way and stay readable.
    const shouldMask = full.channel === "sms" || full.channel === "whatsapp";
    const recipientForConsole = shouldMask ? maskPhone(full.to) : full.to;
    console.warn(
      `[OUTBOUND BLOCKED] channel=${full.channel} reason=${full.reason} to=${recipientForConsole}`,
    );
  } catch (err) {
    console.error("[OUTBOUND] mock log write failed:", err);
  }

  return { success: true, mocked: true, reason: full.reason };
}

/**
 * Read every entry from today's mock log. Returns [] when the file does
 * not exist yet. Test helper — production code should not call this.
 */
export async function readMockOutbound(now: Date = new Date()): Promise<OutboundMockEntry[]> {
  const file = todayFile(now);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as OutboundMockEntry);
}

/** Truncate today's mock log. Test helper. */
export async function clearMockOutbound(now: Date = new Date()): Promise<void> {
  const file = todayFile(now);
  try {
    await fs.unlink(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
