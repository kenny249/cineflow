-- Enforce plan/trial status at the database level so expired users cannot
-- create new projects or upload files, regardless of how the client calls are made.
-- Existing data is never touched — reads and deletes continue to work.

-- ── 1. Helper function ────────────────────────────────────────────────────────
-- Checks whether the workspace owner (the account that owns the current user's
-- workspace) has an active subscription or a non-expired trial.
-- Covers both workspace owners and their collaborators.
CREATE OR REPLACE FUNCTION workspace_has_active_plan()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = get_workspace_owner_id()
      AND (
        plan        = 'lifetime'
        OR plan_status IN ('active', 'founding')
        OR (plan_status = 'trialing' AND trial_ends_at > NOW())
      )
  )
$$;

-- ── 2. projects — only allow INSERT when plan is active ───────────────────────
DROP POLICY IF EXISTS "Workspace owner can insert projects" ON projects;
CREATE POLICY "Workspace owner can insert projects" ON projects
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_workspace_owner()
    AND workspace_has_active_plan()
  );

-- ── 3. project_files — split ALL policy so only INSERT is plan-gated ─────────
-- SELECT, UPDATE, DELETE still work so expired users can view and clean up files.
DROP POLICY IF EXISTS "Workspace members can manage project files" ON project_files;

CREATE POLICY "Workspace members can view project files" ON project_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = get_workspace_owner_id()
    )
  );

CREATE POLICY "Workspace members can insert project files" ON project_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = get_workspace_owner_id()
    )
    AND workspace_has_active_plan()
  );

CREATE POLICY "Workspace members can update project files" ON project_files
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = get_workspace_owner_id()
    )
  );

CREATE POLICY "Workspace members can delete project files" ON project_files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
        AND created_by = get_workspace_owner_id()
    )
  );

-- ── 4. storage.objects — plan-gate file uploads to project-files bucket ───────
DROP POLICY IF EXISTS "project_files_storage_insert" ON storage.objects;
CREATE POLICY "project_files_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND workspace_has_active_plan()
  );
