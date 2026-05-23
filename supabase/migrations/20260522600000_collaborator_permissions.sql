-- ── Collaborator permission flags ────────────────────────────────────────────
-- Granular per-invite permissions for project collaborators.
-- Values: 'mark_shots' | 'add_notes' | 'manage_tasks'

ALTER TABLE project_collaborators
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';

-- Collaborators can read project notes for their active project
CREATE POLICY "Collaborators can view project notes" ON project_notes
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
