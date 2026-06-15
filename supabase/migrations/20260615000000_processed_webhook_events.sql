-- Tracks Stripe webhook event IDs that have been successfully processed.
-- Prevents duplicate processing when Stripe retries events.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id         BIGSERIAL PRIMARY KEY,
  event_id   TEXT        NOT NULL UNIQUE,
  event_type TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast duplicate lookup on every incoming webhook
CREATE INDEX IF NOT EXISTS processed_webhook_events_event_id_idx
  ON processed_webhook_events (event_id);

-- Auto-purge events older than 90 days to keep the table small.
-- Stripe's retry window is 3 days, so 90 days is very conservative.
CREATE OR REPLACE FUNCTION purge_old_webhook_events() RETURNS void
LANGUAGE sql AS $$
  DELETE FROM processed_webhook_events
  WHERE created_at < NOW() - INTERVAL '90 days';
$$;

-- No RLS needed — only accessed via service_role key in the webhook handler.
ALTER TABLE processed_webhook_events DISABLE ROW LEVEL SECURITY;
