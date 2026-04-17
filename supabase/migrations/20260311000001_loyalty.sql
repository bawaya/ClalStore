-- Loyalty program tables
CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze', -- bronze, silver, gold, platinum
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'earn', 'redeem', 'expire', 'bonus', 'adjust'
  points INTEGER NOT NULL, -- positive for earn, negative for redeem
  balance_after INTEGER NOT NULL,
  description TEXT,
  order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_points_customer ON loyalty_points(customer_id);
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id, created_at DESC);
