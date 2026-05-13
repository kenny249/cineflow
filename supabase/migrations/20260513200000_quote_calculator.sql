-- Rate card items: agency's default services + rates
CREATE TABLE IF NOT EXISTS rate_card_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'production',
  default_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_type    TEXT NOT NULL DEFAULT 'day', -- 'day' | 'flat'
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rate_card_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rate card"
  ON rate_card_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX rate_card_items_user_id_idx ON rate_card_items(user_id);

-- Quote estimates: saved internal pricing scratchpads
CREATE TABLE IF NOT EXISTS quote_estimates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Estimate',
  line_items    JSONB NOT NULL DEFAULT '[]',
  overhead_pct  NUMERIC(5,2) NOT NULL DEFAULT 20,
  floor_mult    NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  std_mult      NUMERIC(4,2) NOT NULL DEFAULT 2.0,
  premium_mult  NUMERIC(4,2) NOT NULL DEFAULT 3.5,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quote_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own estimates"
  ON quote_estimates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX quote_estimates_user_id_idx ON quote_estimates(user_id);
CREATE INDEX quote_estimates_created_at_idx ON quote_estimates(created_at DESC);
