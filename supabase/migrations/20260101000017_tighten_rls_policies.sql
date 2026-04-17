-- Migration 017: Tighten overly permissive RLS policies
-- Restrict svc_* policies to service_role only

-- Drop the overly permissive svc_* policies
DROP POLICY IF EXISTS "svc_abandoned" ON abandoned_carts;
DROP POLICY IF EXISTS "svc_reviews" ON product_reviews;
DROP POLICY IF EXISTS "svc_deals" ON deals;
DROP POLICY IF EXISTS "svc_push_subs" ON push_subscriptions;
DROP POLICY IF EXISTS "svc_push_notifs" ON push_notifications;
DROP POLICY IF EXISTS "update_abandoned" ON abandoned_carts;

-- Re-create with service_role restriction
CREATE POLICY "svc_abandoned" ON abandoned_carts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "svc_reviews" ON product_reviews
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "svc_deals" ON deals
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "svc_push_subs" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "svc_push_notifs" ON push_notifications
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tighter update_abandoned: only same visitor or service_role
CREATE POLICY "update_abandoned" ON abandoned_carts
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR visitor_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );
