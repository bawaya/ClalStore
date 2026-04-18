-- =====================================================
-- Fix UNIQUE(order_id, sale_type) to work with PostgREST upsert
-- =====================================================
--
-- Migration 20260418000003 created a PARTIAL unique index:
--   CREATE UNIQUE INDEX ... ON commission_sales (order_id, sale_type)
--   WHERE order_id IS NOT NULL AND deleted_at IS NULL;
--
-- PostgREST's upsert emits `INSERT ... ON CONFLICT (order_id, sale_type)
-- DO UPDATE ...` without a WHERE clause, so PostgreSQL can't use the
-- partial index for conflict inference and errors:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- Fix: drop the partial and replace with a plain (non-partial) unique
-- index on (order_id, sale_type). PG treats multiple NULL order_ids as
-- distinct, so pipeline/pwa rows (order_id=NULL) can coexist. Upsert
-- on a soft-deleted row just resurrects it (updates deleted_at to NULL).
-- =====================================================

-- Clean up dupes before adding the tighter constraint. Keep the most
-- recent active row; soft-delete the rest.
WITH dupes AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY order_id, sale_type
           ORDER BY (deleted_at IS NULL) DESC, created_at DESC, id DESC
         ) AS rn
  FROM commission_sales
  WHERE order_id IS NOT NULL
)
DELETE FROM commission_sales
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

DROP INDEX IF EXISTS uq_commission_sales_order_type;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_sales_order_type
  ON commission_sales (order_id, sale_type);

-- source_sales_doc_id / source_pipeline_deal_id: keep partial indexes
-- for uniqueness enforcement only (registerSaleCommission uses plain
-- INSERT, not upsert, so ON CONFLICT compatibility isn't needed).
-- Narrow the predicate so soft-deleted rows don't block re-creation.
DROP INDEX IF EXISTS uq_commission_sales_source_sales_doc;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_sales_source_sales_doc
  ON commission_sales (source_sales_doc_id, sale_type)
  WHERE source_sales_doc_id IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS uq_commission_sales_source_pipeline_deal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_sales_source_pipeline_deal
  ON commission_sales (source_pipeline_deal_id, sale_type)
  WHERE source_pipeline_deal_id IS NOT NULL AND deleted_at IS NULL;
