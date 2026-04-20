-- Project Templates
CREATE TABLE IF NOT EXISTS project_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  type         TEXT        NOT NULL DEFAULT 'other',
  tasks        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  deliverables JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_templates_own" ON project_templates
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
