-- ── Shoot Days ────────────────────────────────────────────────────────────────
-- A shoot day represents one production day within a project.
-- Shots can be assigned to a day via shot_list_items.shoot_day_id.

CREATE TABLE IF NOT EXISTS shoot_days (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID        REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_by      UUID,
  day_number      INTEGER     NOT NULL,
  date            DATE,
  general_call    TEXT,        -- e.g. "06:00 AM"
  location        TEXT,        -- primary location for the day
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (project_id, day_number)
);

ALTER TABLE shoot_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shoot days" ON shoot_days
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow reading shoot days for any project the user owns
CREATE POLICY "Users can read shoot days for owned projects" ON shoot_days
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = shoot_days.project_id
        AND projects.created_by = auth.uid()
    )
  );

-- Add shoot_day_id to shot_list_items so shots can be assigned to a day
ALTER TABLE shot_list_items
  ADD COLUMN IF NOT EXISTS shoot_day_id UUID REFERENCES shoot_days(id) ON DELETE SET NULL;
