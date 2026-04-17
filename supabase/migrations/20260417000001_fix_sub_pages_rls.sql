-- =====================================================
-- Migration: Fix sub_pages RLS — make policies explicit and least-privilege
--
-- Context:
-- * Migration 014 created sub_pages with policies including a broad
--   "sub_pages_authenticated_all" (FOR ALL TO authenticated USING(true)).
-- * Migration 021 dropped that open policy but never re-declared safe
--   SELECT rules for anon / authenticated. We now rely on an implicit
--   "sub_pages_public_read" for SELECT. That works, but is implicit — any
--   future policy added on sub_pages could re-open it.
--
-- This migration makes the policy model explicit and locked down:
--   * anon can SELECT only is_visible rows
--   * authenticated users can SELECT only is_visible rows (no writes)
--   * service_role (used by the admin API) has full access
-- No INSERT / UPDATE / DELETE is granted to anon or authenticated — writes
-- MUST go through the admin API, which uses the service_role key.
-- =====================================================

-- Ensure RLS is on (idempotent)
ALTER TABLE sub_pages ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies we're about to replace, so the migration
-- is safe to re-run.
DROP POLICY IF EXISTS "sub_pages_public_read"        ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_authenticated_all"  ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_authenticated_read" ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_anon_read"          ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_service_all"        ON sub_pages;

-- Anonymous visitors: SELECT only visible rows
CREATE POLICY "sub_pages_anon_read" ON sub_pages
  FOR SELECT
  TO anon
  USING (is_visible = true);

-- Logged-in users (customers): also SELECT only visible rows — no writes
CREATE POLICY "sub_pages_authenticated_read" ON sub_pages
  FOR SELECT
  TO authenticated
  USING (is_visible = true);

-- Service role: full access (used by the admin API via SUPABASE_SERVICE_ROLE_KEY).
-- Gate every verb with an explicit auth.role() check so that even if this
-- policy is ever mis-attached to a broader role, it refuses to fire.
CREATE POLICY "sub_pages_service_all" ON sub_pages
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Revoke any direct table grants that might have slipped through on prior
-- migrations. RLS + role-scoped policies are the single source of truth.
REVOKE INSERT, UPDATE, DELETE ON sub_pages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON sub_pages FROM authenticated;

-- ===== Done =====
-- ✅ sub_pages has exactly 3 policies, all role-scoped
-- ✅ No USING(true) on any role other than service_role
-- ✅ Anon / authenticated CANNOT write — admin API is the only write path
