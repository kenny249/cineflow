-- Add role label to project_collaborators (e.g. "Director", "1st AD")
ALTER TABLE project_collaborators ADD COLUMN IF NOT EXISTS role text;

-- Individual call times per shoot day per crew member
CREATE TABLE IF NOT EXISTS shoot_day_crew_calls (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id   uuid        NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
  project_id     uuid        NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  collaborator_id uuid       REFERENCES project_collaborators(id) ON DELETE SET NULL,
  name           text        NOT NULL,
  role           text,
  call_time      text        NOT NULL,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shoot_day_crew_calls ENABLE ROW LEVEL SECURITY;

-- Agency / workspace can manage their own crew calls
CREATE POLICY "Workspace members can manage crew calls"
  ON shoot_day_crew_calls FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()
  ));
