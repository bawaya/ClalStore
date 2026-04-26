-- Ensure live CRM inbox schema has drift-free parity with the row types
-- already consumed by the application.

ALTER TABLE inbox_conversations
  ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'neutral';
