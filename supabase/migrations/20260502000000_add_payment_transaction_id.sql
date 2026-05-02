-- Adds the payment_transaction_id column referenced by:
--   - process_payment_callback RPC (migration 20260407000003)
--   - app/api/payment/callback/route.ts (replay protection)
--   - app/api/payment/upay/callback/route.ts
-- The column was assumed by application code and the RPC body but never
-- created on production, causing all online payment callbacks to fail with
-- "column does not exist". Discovered during the 2026-05-02 audit.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

COMMENT ON COLUMN orders.payment_transaction_id IS
  'Provider transaction id (iCredit / UPay). Used for replay protection on payment IPN callbacks. Populated by process_payment_callback RPC.';
