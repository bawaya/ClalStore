// =====================================================
// ClalMobile — Standardized API Response Helpers
// Use these in all API routes for consistent response format
// =====================================================

import { NextResponse } from "next/server";

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
 */
export function apiError(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Extract error message from unknown catch value.
 * Logs the real error internally but returns only the generic fallback.
 * Safe for API responses — never exposes internal error details to clients.
 */
export function errMsg(err: unknown, fallback = "Internal server error"): string {
  if (err instanceof Error) {
    console.error("[API Error]", err.message);
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
 * Log error internally and return a safe generic message to the client.
 * Use this instead of errMsg() in API catch blocks.
 */
export function safeError(err: unknown, context: string, fallback = "Internal server error", status = 500) {
  console.error(`[${context}]`, err instanceof Error ? err.message : err);
  return apiError(fallback, status);
}
