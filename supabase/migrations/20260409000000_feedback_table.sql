-- Feedback table for beta tester submissions
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bug', 'idea', 'other')),
  message TEXT NOT NULL,
  page_url TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Anyone (including anon) can insert feedback — no auth required
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users (you) can read feedback
CREATE POLICY "Authenticated users can read feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (true);
