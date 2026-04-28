// =====================================================
// ClalMobile — Cloudflare Workers Analytics Engine wrapper.
//
// Cheap custom-metrics layer that complements Sentry. Sentry sees the
// `what's broken` view; Analytics Engine sees the `what's the volume`
// view (orders/hour, payments by status, WhatsApp throughput, error
// rates per route, etc.). Free tier: 100K writes/day = ~3.5 events/sec
// sustained — comfortably above ClalMobile's current scale.
//
// The binding (`ANALYTICS`) is declared in `wrangler.json` and exposed
// to the Worker by OpenNext via `getCloudflareContext().env`. We
// resolve the binding lazily and silently no-op when it's missing so
// that:
//   - local `npm run dev` doesn't fail (no binding outside CF runtime),
//   - vitest tests don't fail (same),
//   - a typo in `wrangler.json` doesn't break the request — only
//     metrics drop until the deploy is fixed.
//
// Querying: see Cloudflare Dashboard → Workers & Pages → clalstore →
// Logs → "Analytics Engine" (or run SQL via the GraphQL API).
// =====================================================

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Schema for a single Analytics Engine data point.
 *
 * Cloudflare Analytics Engine has a fixed shape — `blobs` are short
 * strings (think: `"order_created"`, customer id), `doubles` are
 * numerics (amount, latency), `indexes` is a single string used for
 * row-grouping in queries.
 *
 * To stay under the free tier we keep the dataset narrow: one binding,
 * the index column is the metric name, and the schema is the same
 * everywhere so SQL queries are stable across releases.
 */
export interface AnalyticsDataPoint {
  /** Required: the metric name (e.g. "order_created"). Used as the SQL `index1` for grouping. */
  metric: string;
  /** Optional dimensions (string). Up to 19 supported by the schema. */
  dimensions?: string[];
  /** Optional measurements (numeric). Up to 19 supported. */
  values?: number[];
}

interface AnalyticsBinding {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

let warned = false;

/**
 * Resolve the binding. Returns `null` outside of the Cloudflare Worker
 * runtime so callers can no-op.
 */
function getAnalytics(): AnalyticsBinding | null {
  try {
    // OpenNext exposes the Worker's `env` via getCloudflareContext().
    // In dev/test it throws or returns an empty env — both fine, we
    // just no-op. We catch broadly so the worst case is a missing
    // metric, never a broken request.
    const ctx = getCloudflareContext();
    const binding = (ctx?.env as Record<string, unknown> | undefined)?.ANALYTICS;
    if (binding && typeof (binding as AnalyticsBinding).writeDataPoint === "function") {
      return binding as AnalyticsBinding;
    }
  } catch {
    // Outside Worker runtime — getCloudflareContext throws. Fall through.
  }
  if (!warned && process.env.NODE_ENV === "development") {
    // Only warn once in dev so the console isn't flooded.
    console.warn("[analytics] No Workers Analytics binding (running outside CF Worker — silently no-op).");
    warned = true;
  }
  return null;
}

/**
 * Record a data point. Always safe to call — never throws, never
 * blocks the request. Returns `true` if the metric was recorded,
 * `false` if it was silently dropped (e.g. running outside CF).
 *
 * Example:
 *   await recordAnalytics({
 *     metric: "order_created",
 *     dimensions: [orderId, customerId, channel],
 *     values: [orderTotal, itemCount],
 *   });
 */
export function recordAnalytics(point: AnalyticsDataPoint): boolean {
  const analytics = getAnalytics();
  if (!analytics) return false;

  try {
    analytics.writeDataPoint({
      indexes: [point.metric],
      blobs: point.dimensions ?? [],
      doubles: point.values ?? [],
    });
    return true;
  } catch (err) {
    // writeDataPoint shouldn't throw — but if a misconfigured binding
    // does, log to console only. We do NOT forward to Sentry from
    // here: that would create a feedback loop where metric failures
    // become error events that count against the Sentry quota.
    console.error("[analytics] writeDataPoint failed:", err);
    return false;
  }
}

// =====================================================
// Convenience helpers — pre-baked metric names for the
// business events worth watching. New names should be added here, not
// invented at the call site, so SQL queries can reference them
// consistently.
// =====================================================

/** Business: a new order landed in the database. */
export function recordOrderCreated(input: {
  orderId: string;
  customerId?: string | null;
  channel: "web" | "pwa" | "admin" | "crm";
  total: number;
  itemCount: number;
}) {
  return recordAnalytics({
    metric: "order_created",
    dimensions: [input.orderId, input.customerId ?? "guest", input.channel],
    values: [input.total, input.itemCount],
  });
}

/** Business: a payment finished — either succeeded or failed. */
export function recordPaymentOutcome(input: {
  orderId: string;
  status: "succeeded" | "failed" | "pending";
  amount: number;
  provider: "rivhit" | "icredit" | "upay" | "manual";
}) {
  return recordAnalytics({
    metric: "payment_outcome",
    dimensions: [input.orderId, input.status, input.provider],
    values: [input.amount],
  });
}

/** Outbound: a WhatsApp message left the system (real or guarded). */
export function recordWhatsAppSent(input: {
  type: "text" | "buttons" | "template" | "image" | "document";
  blocked: boolean;
  reason?: string;
}) {
  return recordAnalytics({
    metric: "whatsapp_sent",
    dimensions: [input.type, input.blocked ? "blocked" : "sent", input.reason ?? "ok"],
    values: [input.blocked ? 0 : 1],
  });
}

/** Reliability: a 5xx response left the API. */
export function recordServerError(input: {
  route: string;
  status: number;
  context?: string;
}) {
  return recordAnalytics({
    metric: "api_5xx",
    dimensions: [input.route, String(input.status), input.context ?? ""],
    values: [1],
  });
}

/** Auth: someone logged in or signed up. */
export function recordAuthEvent(input: {
  event: "login_attempt" | "login_success" | "login_failed" | "signup_success" | "password_reset";
  channel?: "customer" | "admin" | "employee";
}) {
  return recordAnalytics({
    metric: "auth_event",
    dimensions: [input.event, input.channel ?? "unknown"],
    values: [1],
  });
}
