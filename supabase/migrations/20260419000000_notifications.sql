-- Notifications table for in-app bell
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  href        TEXT,
  read        BOOLEAN DEFAULT false NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read and mark-read their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Any authenticated user (or service role via API routes) can insert
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Enable realtime so the TopBar bell updates live
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
