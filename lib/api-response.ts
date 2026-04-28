// =====================================================
// ClalMobile — Standardized API Response Helpers
// Use these in all API routes for consistent response format.
//
// All catch blocks should funnel through `safeError()` (or `errMsg()` for
// just the message). These helpers forward the exception to Sentry —
// `console.error()` alone is not enough; the Cloudflare Worker logs are
// hard to search and have a short retention. Sentry gets a stack trace,
// a breadcrumb trail, and the request context, all PII-scrubbed by
// `lib/sentry-helpers.ts`.
//
// `apiError()` itself does NOT capture — call sites that don't have a
// real error object (e.g. validation failures returning 400) shouldn't
// flood Sentry. If you want a 5xx response WITH a captured exception,
// use `safeError(err, "context")` instead of bare `apiError("...", 500)`.
// =====================================================

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { recordServerError } from "@/lib/analytics";

interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * Standard success response: { success: true, data, meta? }
 */
export function apiSuccess<T>(data: T, meta?: ApiMeta, status = 200) {
  // Spread object properties at top level for backward compatibility
  // e.g. apiSuccess({ orders: [] }) → { success: true, data: { orders: [] }, orders: [] }
  const body: Record<string, unknown> = { success: true, data };
  if (data && typeof data === "object" && !Array.isArray(data)) {
    Object.assign(body, data);
  }
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

/**
 * Standard error response: { success: false, error }
 *
 * Does NOT capture to Sentry on its own — see file header for the
 * rationale. Call `safeError()` from a catch block to get the response
 * AND the Sentry breadcrumb in one call.
 */
export function apiError(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Extract error message from unknown catch value.
 * Logs the real error internally AND forwards it to Sentry, but returns
 * only the generic fallback. Safe for API responses — never exposes
 * internal error details to clients.
 */
export function errMsg(err: unknown, fallback = "Internal server error"): string {
  if (err instanceof Error) {
    console.error("[API Error]", err.message);
    Sentry.captureException(err);
  } else if (err != null) {
    Sentry.captureMessage(`Non-Error thrown: ${String(err)}`, "error");
  }
  return fallback;
}

/**
 * Extract the actual error message — for internal logging or admin-only debug responses.
 * Do NOT use in public-facing API responses.
 */
export function errDetail(err: unknown, fallback = "Unknown error"): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Log error internally, forward to Sentry, and return a safe generic
 * message to the client. **This is the recommended entry point from a
 * catch block.** It does three things:
 *
 *   1. `console.error` so the message lands in the Cloudflare Worker log
 *      (useful when Sentry is unreachable / quota exhausted).
 *   2. `Sentry.captureException(err, { tags: { context } })` so the
 *      issue is grouped by `context` in the Sentry dashboard. The
 *      `lib/sentry-helpers.scrubEvent()` `beforeSend` hook strips PII
 *      automatically.
 *   3. Returns an `apiError()` response so callers can `return safeError(...)`
 *      directly.
 */
export function safeError(
  err: unknown,
  context: string,
  fallback = "Internal server error",
  status = 500,
) {
  console.error(`[${context}]`, err instanceof Error ? err.message : err);
  if (err instanceof Error) {
    Sentry.captureException(err, {
      tags: { source: "safeError", context },
      extra: { fallback, status },
    });
  } else if (err != null) {
    Sentry.captureMessage(`[${context}] ${String(err)}`, {
      level: "error",
      tags: { source: "safeError", context },
      extra: { fallback, status },
    });
  }
  // Cheap counter to Workers Analytics Engine. Sentry tells us
  // *what's broken*; this counter tells us *how often* — useful for
  // SLO dashboards without Sentry quota burn.
  recordServerError({ route: context, status, context });
  return apiError(fallback, status);
}
