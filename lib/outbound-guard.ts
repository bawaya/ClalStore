// =====================================================
// Outbound message guard — defense in depth
// Decides whether a real email/SMS/WhatsApp send may
// proceed, or must be intercepted into the local mock
// store. Used by every outbound caller.
//
// Three layers — any of them blocks → no real send:
//   1. MOCK_OUTBOUND=true (explicit kill switch)
//   2. NODE_ENV !== "production" without an explicit
//      ALLOW_REAL_OUTBOUND=true escape hatch.
//   3. API key matches a sandbox/test pattern.
//
// The function is dependency-free so it can be imported
// anywhere — provider, route handler, or test helper —
// without dragging Supabase or other heavy modules.
// =====================================================

export type OutboundChannel =
  | "email"
  | "sms"
  | "whatsapp"
  /**
   * Mutating WhatsApp Business template operations (createTemplate /
   * deleteTemplate / provisionRequiredTemplates). Treated as its own channel
   * so the JSONL log distinguishes a template mutation from a normal message
   * send, and so the secondary ALLOW_TEMPLATE_MUTATIONS gate is documented
   * next to the rest of the outbound machinery.
   */
  | "whatsapp_template";

export interface OutboundGuardResult {
  blocked: boolean;
  /** Stable code for log/test assertions; absent when allowed. */
  reason?:
    | "mock_outbound_flag"
    | "non_production_no_escape_hatch"
    | "suspicious_api_key";
  /** Human-friendly explanation (Arabic + English mix); absent when allowed. */
  detail?: string;
}

const SUSPICIOUS_KEY_PREFIXES = ["test_", "sandbox_", "mock_", "fake_"] as const;

/**
 * Read the relevant API key for a channel. Defaults to "" so an unset key
 * never accidentally matches a suspicious prefix.
 */
function readChannelKeys(channel: OutboundChannel): string[] {
  switch (channel) {
    case "email":
      return [
        process.env.RESEND_API_KEY ?? "",
        process.env.SENDGRID_API_KEY ?? "",
      ];
    case "sms":
      return [
        process.env.TWILIO_ACCOUNT_SID ?? "",
        process.env.TWILIO_AUTH_TOKEN ?? "",
      ];
    case "whatsapp":
    case "whatsapp_template":
      return [process.env.YCLOUD_API_KEY ?? ""];
  }
}

function looksLikeSuspiciousKey(key: string): boolean {
  if (!key) return false;
  const lowered = key.toLowerCase();
  return SUSPICIOUS_KEY_PREFIXES.some((prefix) => lowered.startsWith(prefix));
}

/**
 * Decide whether an outbound send for `channel` is blocked.
 * Pure function — no I/O, no logging. Callers wrap it.
 */
export function isOutboundBlocked(
  channel: OutboundChannel,
): OutboundGuardResult {
  // Layer 1 — explicit kill switch. Highest priority so a developer running
  // tests can guarantee no message escapes regardless of NODE_ENV.
  if (process.env.MOCK_OUTBOUND === "true") {
    return {
      blocked: true,
      reason: "mock_outbound_flag",
      detail: "MOCK_OUTBOUND=true is set",
    };
  }

  // Layer 2 — non-production environments are blocked by default. The
  // ALLOW_REAL_OUTBOUND=true escape hatch exists for future staging work but
  // is intentionally absent in dev/CI so a forgotten env var never leaks.
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "production" && process.env.ALLOW_REAL_OUTBOUND !== "true") {
    return {
      blocked: true,
      reason: "non_production_no_escape_hatch",
      detail: `NODE_ENV=${nodeEnv ?? "undefined"} (not production) and ALLOW_REAL_OUTBOUND is not "true"`,
    };
  }

  // Layer 3 — sandbox-pattern API keys. Even in production with all flags
  // set correctly, a key that *looks* like test_/sandbox_/mock_/fake_ is
  // refused so a misconfigured deploy can't punch through.
  const keys = readChannelKeys(channel);
  for (const key of keys) {
    if (looksLikeSuspiciousKey(key)) {
      return {
        blocked: true,
        reason: "suspicious_api_key",
        detail: `${channel} API key looks like a sandbox/test credential`,
      };
    }
  }

  return { blocked: false };
}
