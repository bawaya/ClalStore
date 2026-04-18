// =====================================================
// ClalMobile — Constant-time token comparison helper
// Mitigates timing-based token probing (audit issue 4.25).
// =====================================================

import { timingSafeEqual } from "crypto";

/**
 * Constant-time string compare for bearer tokens and similar secrets.
 *
 * Returns `false` for any falsy input (null/undefined/empty) so callers
 * can use it as a drop-in replacement for `a === b && a && b` patterns.
 *
 * Uses Node's `crypto.timingSafeEqual` on equal-length buffers. Buffers
 * of different lengths short-circuit to `false` (length leak is
 * unavoidable and considered acceptable — the token secret itself is
 * constant-length in practice).
 */
export function safeTokenEqual(
  a: string | undefined | null,
  b: string | undefined | null,
): a is string {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
