CREATE TABLE IF NOT EXISTS edit_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other', -- social | commercial | narrative | documentary | corporate | other
  duration_secs INTEGER NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE edit_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own edit sessions"
  ON edit_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX edit_sessions_user_id_idx ON edit_sessions(user_id);
CREATE INDEX edit_sessions_created_at_idx ON edit_sessions(created_at DESC);
