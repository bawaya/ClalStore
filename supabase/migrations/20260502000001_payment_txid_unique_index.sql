-- Defence-in-depth replay protection for iCredit / UPay callbacks.
-- Application code already checks for duplicate transaction IDs in
-- `app/api/payment/callback/route.ts`, but a unique partial index closes the
-- TOCTOU window between SELECT and UPDATE under concurrent IPN delivery.

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_transaction_id_unique
  ON orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;
