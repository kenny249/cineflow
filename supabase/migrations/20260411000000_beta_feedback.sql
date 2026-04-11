-- Beta feedback responses table (anonymous, no user_id)
CREATE TABLE IF NOT EXISTS beta_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_frequency text NOT NULL,
  top_features    text[] NOT NULL DEFAULT '{}',
  workflow_fit    text NOT NULL,
  would_pay       text NOT NULL,
  price_range     text NOT NULL,
  pricing_model   text NOT NULL,
  missing_feature text,
  star_rating     int CHECK (star_rating BETWEEN 1 AND 5),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- No RLS — anonymous inserts from authenticated users
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to insert (anonymous survey)
CREATE POLICY "anyone can submit beta feedback"
  ON beta_feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No select policy — results only visible via Supabase dashboard / service key
