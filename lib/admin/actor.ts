// =====================================================
// ClalMobile — Admin actor ID helper
// Centralises the `appUserId || auth.id` fallback pattern so we never
// accidentally write `auth.users.id` into a column that expects
// `public.users.id` (audit issue 4.8).
// =====================================================

/**
 * Shape we consume from `requireAdmin(req)` — we only care about the
 * `appUserId` field (public.users.id) and the `id` field (auth.users.id).
 *
 * Intentionally loose so we can accept the various union returns from
 * `requireAdmin` without forcing a shared type in every consumer.
 */
export interface AdminActorLike {
  appUserId?: string | null;
  id?: string | null;
}

/**
 * Resolve the public.users.id for audit / actor columns.
 *
 * IMPORTANT: this intentionally does NOT fall back to `auth.id`
 * (which is the auth.users.id). Mixing the two IDs silently corrupts
 * foreign keys into `public.users`. If `appUserId` is missing we use
 * the sentinel `"system"` so the INSERT still succeeds without a
 * broken FK.
 */
export function actorId(auth: AdminActorLike | null | undefined): string {
  return auth?.appUserId || "system";
}
