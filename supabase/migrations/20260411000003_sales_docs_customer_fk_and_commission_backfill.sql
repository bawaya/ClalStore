-- =====================================================
-- ClalMobile — Sales docs customer FK + commission backfill
-- Align sales_docs.customer_id with customers(id) and backfill
-- commission_sales.customer_id from orders.customer_id.
-- =====================================================

ALTER TABLE sales_docs
  ALTER COLUMN customer_id TYPE UUID
  USING NULLIF(customer_id, '')::uuid;

ALTER TABLE sales_docs
  DROP CONSTRAINT IF EXISTS sales_docs_customer_id_fkey;

ALTER TABLE sales_docs
  ADD CONSTRAINT sales_docs_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_docs_customer_id
  ON sales_docs(customer_id)
  WHERE deleted_at IS NULL AND customer_id IS NOT NULL;

UPDATE commission_sales AS cs
SET customer_id = o.customer_id
FROM orders AS o
WHERE cs.order_id = o.id
  AND cs.customer_id IS NULL
  AND o.customer_id IS NOT NULL;