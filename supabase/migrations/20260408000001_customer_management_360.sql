-- Migration: Customer Management 360°
-- Adds source tracking, assignment, and notes for full customer management

-- 1) Add new columns to customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS notes text;

-- 2) Create customer_notes table
CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);

-- 4) RLS for customer_notes (service role bypasses, anon blocked)
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on customer_notes"
  ON customer_notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
