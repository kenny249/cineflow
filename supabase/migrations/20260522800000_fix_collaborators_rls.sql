-- Fix: "agency can manage collaborators" was directly querying auth.users,
-- which the authenticated role cannot access. This caused a cascade failure
-- when the "Collaborators can view their assigned project" policy on projects
-- triggered project_collaborators RLS evaluation, which in turn tried to
-- SELECT from auth.users and got "permission denied for table users".
--
-- Fix: replace auth.users reference with get_workspace_owner_id() which is
-- SECURITY DEFINER and reads workspace_id from profiles instead.

DROP POLICY IF EXISTS "agency can manage collaborators" ON project_collaborators;

CREATE POLICY "agency can manage collaborators"
  ON project_collaborators FOR ALL
  USING (invited_by = get_workspace_owner_id())
  WITH CHECK (invited_by = get_workspace_owner_id());
