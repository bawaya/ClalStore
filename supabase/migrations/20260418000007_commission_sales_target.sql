-- =====================================================================
-- ClalMobile — Commission dashboard: sales-value target + manual add-on
-- 2026-04-18
--
-- Admins asked to re-orient the commissions dashboard around SALES value
-- (gross contract value sold) rather than commission earned. Two new
-- fields on commission_targets:
--
--   target_sales_amount
--     Monthly SALES amount target (₪). Independent of target_total, which
--     remains the monthly COMMISSION target. Nullable — optional.
--
--   manual_sales_add_on
--     Off-platform sales (cash deals, external systems) that admin wants
--     counted toward the sales total. Additive, not a replacement. Default 0.
--
-- Both are NUMERIC(12,2), identical scale to other commission money
-- columns, and safe under the existing check_month_lock trigger because
-- the lock check is on commission_sales / commission_sanctions, not on
-- commission_targets updates (admin can always edit targets).
-- =====================================================================

ALTER TABLE commission_targets
  ADD COLUMN IF NOT EXISTS target_sales_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS manual_sales_add_on NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN commission_targets.target_sales_amount IS
  'Monthly SALES value target (gross contract value). Nullable. Separate from target_total which targets commission earned.';
COMMENT ON COLUMN commission_targets.manual_sales_add_on IS
  'Admin-entered offline/external sales value, additive to auto-tracked sales. Default 0.';
