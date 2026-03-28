// =====================================================
// ClalMobile — Persistent Rate Limiter (Supabase-backed)
// Works across serverless instances unlike in-memory maps.
// Falls back to in-memory if DB unavailable.
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  webhook: { maxRequests: 120, windowMs: 60_000 },
  api: { maxRequests: 60, windowMs: 60_000 },
  login: { maxRequests: 5, windowMs: 60_000 },
  upload: { maxRequests: 10, windowMs: 60_000 },
};

// In-memory fallback (used when DB is unavailable)
const memStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function memCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of memStore) {
    if (entry.resetAt < now) memStore.delete(key);
  }
}

function memCheck(key: string, config: RateLimitConfig) {
  memCleanup();
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }
  entry.count++;
  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Check rate limit using Supabase `rate_limits` table.
 * Falls back to in-memory if DB is unavailable.
 *
 * Table schema (create via migration):
 *   rate_limits (key TEXT PRIMARY KEY, count INT, reset_at TIMESTAMPTZ)
 */
export async function checkRateLimitDb(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const sb = createAdminSupabase();
    if (!sb) return memCheck(key, config);

    const now = Date.now();
    const resetAt = new Date(now + config.windowMs).toISOString();

    // Upsert: increment count if within window, reset if expired
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_key: key,
      p_max: config.maxRequests,
      p_window_ms: config.windowMs,
      p_reset_at: resetAt,
    });

    if (error || data == null) {
      // RPC not available — fall back to in-memory
      return memCheck(key, config);
    }

    // RPC returns { allowed, remaining, reset_at }
    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: new Date(data.reset_at).getTime(),
    };
  } catch {
    // DB error — fall back to in-memory
    return memCheck(key, config);
  }
}

// Synchronous in-memory check (for middleware — can't await in some contexts)
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  return memCheck(key, config);
}

export function getRateLimitKey(ip: string, prefix: string): string {
  return `${prefix}:${ip}`;
}
