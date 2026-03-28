-- =====================================================
-- Rate Limits table + RPC for persistent rate limiting
-- Works across serverless instances
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);

-- Atomic rate limit check: increment or reset counter
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_ms INTEGER,
  p_reset_at TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_reset TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_allowed BOOLEAN;
  v_remaining INTEGER;
BEGIN
  -- Try to get existing entry
  SELECT count, reset_at INTO v_count, v_reset
  FROM rate_limits WHERE key = p_key FOR UPDATE;

  IF NOT FOUND OR v_reset < v_now THEN
    -- No entry or expired — create/reset
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_ms || ' milliseconds')::interval)
    ON CONFLICT (key) DO UPDATE SET count = 1, reset_at = v_now + (p_window_ms || ' milliseconds')::interval;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max - 1,
      'reset_at', v_now + (p_window_ms || ' milliseconds')::interval
    );
  ELSE
    -- Within window — increment
    v_count := v_count + 1;
    UPDATE rate_limits SET count = v_count WHERE key = p_key;

    v_allowed := v_count <= p_max;
    v_remaining := GREATEST(0, p_max - v_count);

    RETURN jsonb_build_object(
      'allowed', v_allowed,
      'remaining', v_remaining,
      'reset_at', v_reset
    );
  END IF;
END;
$$;

-- Periodic cleanup function (call from cron or manually)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE reset_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
