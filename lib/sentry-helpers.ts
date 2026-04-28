// =====================================================
// ClalMobile — Sentry Helpers
// Shared sample rates and a beforeSend PII scrubber. Israeli Privacy
// Protection Law Amendment 13 forbids sending PII to a third-party
// processor without a clear consent record, so we strip request bodies,
// query strings, cookies, and known user fields before any event leaves
// the runtime. The DSN-bearing init() lives in sentry.{client,server,edge}.
// =====================================================

// Sentry has three runtimes (browser / node / edge) and each ships its own
// flavour of `ErrorEvent` / `TransactionEvent`. The shapes are
// structurally similar but the SDK marks several nested fields as required
// in subtly different ways across runtimes, so a tight structural type
// can't cover all three at once. The scrubber is generic over the actual
// runtime event type and narrows nested fields via runtime guards — the
// type parameter `E` keeps the return type aligned with the call site, so
// `Sentry.init({ beforeSend(e) { return scrubEvent(e); } })` type-checks
// in every runtime without any cast.

/** Read the Sentry DSN from the environment, with a tiny ergonomic guard. */
export function sentryDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return dsn ? dsn : undefined;
}

/** True when we're running in production (Cloudflare Workers / OpenNext). */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Trace sample rate: 100% in development for visibility, 10% in production
 * to stay well under the Sentry Free Tier (5K errors / month). Override via
 * `SENTRY_TRACES_SAMPLE_RATE` for short investigations.
 */
export function tracesSampleRate(): number {
  const override = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "");
  if (Number.isFinite(override) && override >= 0 && override <= 1) return override;
  return isProduction() ? 0.1 : 1.0;
}

/**
 * Session Replay sampling. Default 1% in production (full replay only on
 * errors). 100% in dev so we can debug locally.
 */
export function replaysSessionSampleRate(): number {
  const override = parseFloat(process.env.SENTRY_REPLAY_SESSION_SAMPLE_RATE || "");
  if (Number.isFinite(override) && override >= 0 && override <= 1) return override;
  return isProduction() ? 0.01 : 1.0;
}

/** Replay rate when an error is captured — always 100%; the cap is the session rate. */
export const replaysOnErrorSampleRate = 1.0;

// PII scrubber ---------------------------------------------------------------

const PII_HEADER_KEYS = [
  "cookie",
  "set-cookie",
  "authorization",
  "x-csrf-token",
  "x-api-key",
  "x-supabase-auth",
];

const PII_BODY_KEYS = [
  "customer_phone",
  "customer_name",
  "phone",
  "email",
  "password",
  "card_number",
  "cvv",
  "cardholder",
  "icredit_token",
  "rivhit_token",
  "auth_token",
  "supabase_token",
];

const PHONE_RX = /\+?\d[\d\s\-()]{6,}\d/g;
const EMAIL_RX = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function redact<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === "string") {
    return input.replace(PHONE_RX, "[REDACTED_PHONE]").replace(EMAIL_RX, "[REDACTED_EMAIL]") as unknown as T;
  }
  if (Array.isArray(input)) return input.map(redact) as unknown as T;
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (PII_BODY_KEYS.includes(k.toLowerCase())) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = redact(v);
    }
    return out as unknown as T;
  }
  return input;
}

/**
 * Strip PII out of an event in place. Aggressive on purpose — once data
 * leaves our infra it's outside our consent record, so the safer default is
 * to redact and re-inject only what an engineer explicitly attaches via
 * `Sentry.setContext` / `Sentry.setUser({ id })` (a hashed identifier is OK).
 *
 * Each Sentry runtime ships its own structurally-similar but nominally
 * different `ErrorEvent` / `TransactionEvent` types, so the public signature
 * is generic over `SentryLikeEvent`; the body uses small runtime guards so
 * we don't have to keep three near-identical structural types in sync with
 * the SDK.
 */
export function scrubEvent<E>(event: E): E {
  // Operate via a loose alias so we don't have to keep a structural copy of
  // Sentry's `ErrorEvent` / `TransactionEvent` in sync. The return value is
  // the same reference (mutated in place), so the caller's `E` is preserved.
  const e = event as {
    request?: {
      headers?: Record<string, string | undefined>;
      cookies?: Record<string, string>;
      query_string?: unknown;
      data?: unknown;
    };
    user?: { id?: string | undefined; [k: string]: unknown };
    contexts?: Record<string, unknown>;
    extra?: Record<string, unknown>;
    breadcrumbs?: Array<{ data?: Record<string, unknown> | undefined; [k: string]: unknown }>;
  };

  // Drop the entire user object. Engineers can attach `{ id: hashedUserId }` later.
  if (e.user) e.user = { id: e.user.id };

  if (e.request) {
    if (e.request.headers) {
      for (const k of Object.keys(e.request.headers)) {
        if (PII_HEADER_KEYS.includes(k.toLowerCase())) {
          e.request.headers[k] = "[REDACTED]";
        }
      }
    }
    // `cookies` is typed `Record<string, string>` in the SDK — clear it
    // rather than stringifying so the type stays valid.
    if (e.request.cookies) e.request.cookies = {};
    if (e.request.query_string) e.request.query_string = "[REDACTED]";
    if (e.request.data) e.request.data = redact(e.request.data);
  }

  if (e.contexts) e.contexts = redact(e.contexts);
  if (e.extra) e.extra = redact(e.extra);
  if (e.breadcrumbs) {
    e.breadcrumbs = e.breadcrumbs.map((b) => ({ ...b, data: b.data ? redact(b.data) : b.data }));
  }

  return event;
}

/**
 * `beforeSendLog` scrubber — runs on every Sentry Log record (the new
 * structured-logs product, separate from Issues). Logs go through:
 *   1. `Sentry.logger.info/warn/error/...` direct calls in app code, AND
 *   2. `consoleLoggingIntegration` which forwards `console.warn` /
 *      `console.error` to Sentry as logs.
 *
 * The forwarding is the dangerous one: ClalMobile has ~93 `console.error`
 * call sites and some include user-supplied data
 * (`console.error("Order failed for", customer.phone, ...)`). Without a
 * scrubber, all that PII would land in Sentry's Logs tab, violating
 * Israeli Privacy Protection Law Amendment 13 (`AGREEMENTS.md` §5.3).
 *
 * Returns:
 *   - the (mutated) log to forward it, or
 *   - `null` to drop the log entirely (we drop `debug`/`trace` levels in
 *     production to stay under the Logs free quota).
 */
export function scrubLog<L>(log: L): L | null {
  // Loose typing — Sentry's internal Log type isn't reliably exported.
  // We treat the input as a record-of-anything and only touch known keys.
  const l = log as {
    level?: string;
    message?: string | { template?: string; params?: unknown[] };
    body?: string;
    attributes?: Record<string, unknown>;
    severity_text?: string;
  };

  // Drop debug/trace logs in production — they're too verbose for the
  // 100K-logs / month free tier and not actionable from a dashboard.
  if (process.env.NODE_ENV === "production") {
    const lvl = (l.level ?? l.severity_text ?? "").toLowerCase();
    if (lvl === "debug" || lvl === "trace") return null;
  }

  // Scrub the message string (or fmt template) so phone numbers and
  // emails accidentally interpolated into a log message don't leak.
  if (typeof l.message === "string") {
    l.message = l.message.replace(PHONE_RX, "[REDACTED_PHONE]").replace(EMAIL_RX, "[REDACTED_EMAIL]");
  } else if (l.message && typeof l.message === "object" && typeof l.message.template === "string") {
    l.message.template = l.message.template
      .replace(PHONE_RX, "[REDACTED_PHONE]")
      .replace(EMAIL_RX, "[REDACTED_EMAIL]");
  }
  if (typeof l.body === "string") {
    l.body = l.body.replace(PHONE_RX, "[REDACTED_PHONE]").replace(EMAIL_RX, "[REDACTED_EMAIL]");
  }

  // Attributes are key/value pairs the engineer attached to the log
  // (e.g. `{ orderId, customerPhone }`). Run them through the same
  // redact() that powers scrubEvent.
  if (l.attributes) {
    l.attributes = redact(l.attributes) as typeof l.attributes;
  }

  return log;
}
