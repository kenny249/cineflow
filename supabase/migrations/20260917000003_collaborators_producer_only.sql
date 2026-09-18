-- "agency can manage collaborators" (tightened in 20260522800000) checks
-- `invited_by = get_workspace_owner_id()`. The API route stamps invited_by
-- with the actual caller's id (app/api/projects/[id]/collaborators/route.ts),
-- so that check only ever passes when the caller IS the literal workspace
-- owner — it blocks every other team member, including Producer/admin roles,
-- rather than gating by role as intended. Confirmed live 2026-09-18: a
-- Producer-equivalent test account got "new row violates row-level security
-- policy" on invite.
--
-- Replace it with the same role + project-ownership shape already used for
-- budget_lines/invoices (20260512100000): any Producer or the owner may
-- manage collaborators on a project that belongs to their workspace, and any
-- workspace member may view who's on a project.

DROP POLICY IF EXISTS "agency can manage collaborators" ON project_collaborators;

CREATE POLICY "workspace members can view collaborators" ON project_collaborators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
        AND created_by = get_workspace_owner_id()
    )
  );

CREATE POLICY "producers can manage collaborators" ON project_collaborators
  FOR INSERT
  WITH CHECK (
    is_producer_or_above()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
        AND created_by = get_workspace_owner_id()
    )
  );

CREATE POLICY "producers can update collaborators" ON project_collaborators
  FOR UPDATE
  USING (
    is_producer_or_above()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
        AND created_by = get_workspace_owner_id()
    )
  )
  WITH CHECK (
    is_producer_or_above()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
        AND created_by = get_workspace_owner_id()
    )
  );

CREATE POLICY "producers can delete collaborators" ON project_collaborators
  FOR DELETE
  USING (
    is_producer_or_above()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_collaborators.project_id
        AND created_by = get_workspace_owner_id()
    )
  );
