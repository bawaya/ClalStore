-- =====================================================
-- Migration 022: Align order status CHECK constraint
-- Adds missing statuses: processing, cancelled, returned
-- Ensures DB, API, and frontend constants are in sync
-- =====================================================

-- Drop the old CHECK constraint and add a new one with all valid statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'new', 'approved', 'processing', 'shipped', 'delivered',
    'cancelled', 'rejected', 'returned',
    'no_reply_1', 'no_reply_2', 'no_reply_3'
  ));
