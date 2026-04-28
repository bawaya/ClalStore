// =====================================================
// Test helpers for the outbound mock layer.
//
// JSONL helpers (always available):
//   getMockedEmails / getMockedSMS / getMockedWhatsApp /
//   getMockedWhatsAppTemplates  — filter today's mock log by channel.
//   clearMockedOutbound          — truncate today's mock log.
//
// Mailpit HTTP API helpers (require docker compose -f
// docker-compose.test.yml up -d mailpit):
//   isMailpitRunning      — quick probe; tests should skip if false.
//   getMailpitMessages    — list every email Mailpit captured.
//   clearMailpit          — delete every email so a test starts clean.
//
// All helpers honour MOCK_OUTBOUND_LOG_DIR / MAILPIT_API_URL when set,
// so a test can point them at a temp directory or a non-default port.
// =====================================================

import type { OutboundChannel } from "@/lib/outbound-guard";
import {
  type OutboundMockEntry,
  readMockOutbound,
  clearMockOutbound,
} from "@/lib/outbound-mock";

const DEFAULT_MAILPIT_API = "http://localhost:8025";

function mailpitApiUrl(): string {
  const raw = process.env.MAILPIT_API_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : DEFAULT_MAILPIT_API;
}

// ===== JSONL filters =====

async function getByChannel(channel: OutboundChannel): Promise<OutboundMockEntry[]> {
  const all = await readMockOutbound();
  return all.filter((e) => e.channel === channel);
}

export const getMockedEmails = () => getByChannel("email");
export const getMockedSMS = () => getByChannel("sms");
export const getMockedWhatsApp = () => getByChannel("whatsapp");
export const getMockedWhatsAppTemplates = () => getByChannel("whatsapp_template");

export async function getAllMockedOutbound(): Promise<OutboundMockEntry[]> {
  return readMockOutbound();
}

export async function clearMockedOutbound(): Promise<void> {
  await clearMockOutbound();
}

// ===== Mailpit HTTP API =====

export interface MailpitMessageSummary {
  ID: string;
  From: { Address: string; Name?: string };
  To: { Address: string; Name?: string }[];
  Subject: string;
  Created: string;
  Snippet?: string;
}

interface MailpitListResponse {
  messages: MailpitMessageSummary[];
  total: number;
  unread: number;
  count: number;
}

/**
 * Returns true when the Mailpit container responds within ~1 second.
 * Test files should call this and skip with `test.skip(!alive, ...)` so
 * the suite passes whether or not the developer started Mailpit.
 */
export async function isMailpitRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${mailpitApiUrl()}/api/v1/info`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch {
    return false;
  }
}

export async function getMailpitMessages(): Promise<MailpitMessageSummary[]> {
  const res = await fetch(`${mailpitApiUrl()}/api/v1/messages`);
  if (!res.ok) {
    throw new Error(`Mailpit messages fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as MailpitListResponse;
  return data.messages || [];
}

export async function clearMailpit(): Promise<void> {
  const res = await fetch(`${mailpitApiUrl()}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Mailpit clear failed: ${res.status}`);
  }
}
