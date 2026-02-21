-- =====================================================
-- ClalMobile — AI Enhancement Tables
-- Migration 008: AI usage tracking + sentiment column
-- =====================================================

-- جدول تتبع استهلاك AI
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,  -- bot_reply, smart_reply, summary, sentiment, smart_search
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  duration_ms INTEGER DEFAULT 0,
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage(feature, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_ai_usage" ON ai_usage FOR ALL USING (auth.role() = 'service_role');

-- إضافة عمود المزاج للمحادثات
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'neutral';
-- قيم: positive, neutral, negative, angry

CREATE INDEX IF NOT EXISTS idx_inbox_conv_sentiment ON inbox_conversations(sentiment);
