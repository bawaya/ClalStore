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
 * Extract error message from unknown catch value
 */
export function errMsg(err: unknown, fallback = "Unknown error"): string {
  return err instanceof Error ? err.message : fallback;
}
