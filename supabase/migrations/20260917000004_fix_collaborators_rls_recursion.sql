-- EMERGENCY FIX for 20260917000003: that migration's project_collaborators
-- policies query `projects` directly (EXISTS (SELECT 1 FROM projects ...)),
-- but `projects` already has a policy ("Collaborators can view their
-- assigned project", 20260522500000) that queries `project_collaborators`.
-- That's a cycle — evaluating either table's RLS now re-triggers the
-- other's, and Postgres correctly refuses with "infinite recursion detected
-- in policy for relation projects". Confirmed live 2026-09-18: this broke
-- ALL reads of the projects table, for every user, immediately after
-- 20260917000003 was applied.
--
-- Fix: move the "does this project belong to my workspace" check into a
-- SECURITY DEFINER function. Postgres table owners bypass their own table's
-- RLS by default, and functions created by the migration role own that
-- privilege — this is exactly why get_workspace_owner_id() / is_producer_or_above()
-- can already safely query profiles/team_members from inside other tables'
-- policies without recursing. The same trick applied to a `projects` lookup
-- breaks this cycle the same way.

CREATE OR REPLACE FUNCTION project_owned_by_workspace(pid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = pid AND created_by = get_workspace_owner_id()
  )
$$;

DROP POLICY IF EXISTS "workspace members can view collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "producers can manage collaborators"       ON project_collaborators;
DROP POLICY IF EXISTS "producers can update collaborators"       ON project_collaborators;
DROP POLICY IF EXISTS "producers can delete collaborators"       ON project_collaborators;

CREATE POLICY "workspace members can view collaborators" ON project_collaborators
  FOR SELECT
  USING (project_owned_by_workspace(project_id));

CREATE POLICY "producers can manage collaborators" ON project_collaborators
  FOR INSERT
  WITH CHECK (is_producer_or_above() AND project_owned_by_workspace(project_id));

CREATE POLICY "producers can update collaborators" ON project_collaborators
  FOR UPDATE
  USING (is_producer_or_above() AND project_owned_by_workspace(project_id))
  WITH CHECK (is_producer_or_above() AND project_owned_by_workspace(project_id));

CREATE POLICY "producers can delete collaborators" ON project_collaborators
  FOR DELETE
  USING (is_producer_or_above() AND project_owned_by_workspace(project_id));
