-- ─── Project Equipment ────────────────────────────────────────────────────────
-- Per-project camera package, audio, lighting, support, and other gear.
-- Lenses are stored as JSONB on the camera row for simplicity.

CREATE TABLE IF NOT EXISTS project_equipment (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  category       TEXT        NOT NULL CHECK (category IN ('camera', 'audio', 'lighting', 'support', 'other')),
  name           TEXT        NOT NULL,
  brand          TEXT,
  model          TEXT,
  assigned_to    TEXT,
  role           TEXT,
  lenses         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  specs          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_rental      BOOLEAN     NOT NULL DEFAULT false,
  rental_vendor  TEXT,
  serial_number  TEXT,
  notes          TEXT,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_equipment_project  ON project_equipment(project_id);
CREATE INDEX IF NOT EXISTS idx_project_equipment_category ON project_equipment(project_id, category);

ALTER TABLE project_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_select" ON project_equipment FOR SELECT USING (
  project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM projects WHERE created_by = auth.uid()
  )
);

CREATE POLICY "equipment_insert" ON project_equipment FOR INSERT WITH CHECK (
  project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM projects WHERE created_by = auth.uid()
  )
);

CREATE POLICY "equipment_update" ON project_equipment FOR UPDATE USING (
  project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM projects WHERE created_by = auth.uid()
  )
);

CREATE POLICY "equipment_delete" ON project_equipment FOR DELETE USING (
  project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM projects WHERE created_by = auth.uid()
  )
);
