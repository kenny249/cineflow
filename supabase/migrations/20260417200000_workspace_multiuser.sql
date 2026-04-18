-- ============================================================
-- Workspace Multi-User — Beta
--
-- Strategy: "workspace_id" on profiles = the workspace owner's user_id.
--   - Owner signs up normally → workspace_id = their own uid (backfilled)
--   - Invited member accepts → workspace_id = owner's uid (set by API)
--
-- get_workspace_owner_id() is the single function all policies call.
-- It returns auth.uid() for the owner, and the owner's uid for any member.
--
-- RLS rule:
--   SELECT / UPDATE: any workspace member can read/edit
--   INSERT / DELETE: owner only for top-level records; any member for
--                    project-linked records (revisions, tasks, files, etc.)
-- ============================================================

-- ─── 1. workspace_id column on profiles ──────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: existing users own their own workspace
UPDATE profiles SET workspace_id = id WHERE workspace_id IS NULL;

-- ─── 2. Core workspace helper function ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_workspace_owner_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT workspace_id FROM profiles WHERE id = auth.uid()),
    auth.uid()
  )
$$;

-- Returns true if the calling user is the workspace owner (not just a member)
CREATE OR REPLACE FUNCTION is_workspace_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.uid() = get_workspace_owner_id()
$$;

-- ─── 3. projects ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own projects"   ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- Any workspace member can view projects owned by the workspace
CREATE POLICY "Workspace members can view projects" ON projects
  FOR SELECT USING (created_by = get_workspace_owner_id());

-- Only the workspace owner can create projects
CREATE POLICY "Workspace owner can insert projects" ON projects
  FOR INSERT WITH CHECK (created_by = auth.uid() AND is_workspace_owner());

-- Any workspace member can update projects
CREATE POLICY "Workspace members can update projects" ON projects
  FOR UPDATE USING (created_by = get_workspace_owner_id());

-- Only the workspace owner can delete projects
CREATE POLICY "Workspace owner can delete projects" ON projects
  FOR DELETE USING (created_by = get_workspace_owner_id() AND is_workspace_owner());

-- ─── 4. project-linked tables (RLS via project ownership) ────────────────────
-- Pattern: EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id())
-- This replaces auth.uid() with get_workspace_owner_id() in all project checks.

-- project_notes
DROP POLICY IF EXISTS "Users can manage notes on their projects" ON project_notes;
CREATE POLICY "Workspace members can manage project notes" ON project_notes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- shot_lists
DROP POLICY IF EXISTS "Users can manage shot_lists on their projects" ON shot_lists;
CREATE POLICY "Workspace members can manage shot lists" ON shot_lists
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- shot_list_items
DROP POLICY IF EXISTS "Users can manage shot_list_items via their shot lists" ON shot_list_items;
CREATE POLICY "Workspace members can manage shot list items" ON shot_list_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shot_lists sl
      JOIN projects p ON p.id = sl.project_id
      WHERE sl.id = shot_list_id AND p.created_by = get_workspace_owner_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shot_lists sl
      JOIN projects p ON p.id = sl.project_id
      WHERE sl.id = shot_list_id AND p.created_by = get_workspace_owner_id()
    )
  );

-- storyboard_frames
DROP POLICY IF EXISTS "Users can manage storyboard_frames on their projects" ON storyboard_frames;
CREATE POLICY "Workspace members can manage storyboard frames" ON storyboard_frames
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- revisions
DROP POLICY IF EXISTS "Users can manage revisions on their projects" ON revisions;
CREATE POLICY "Workspace members can manage revisions" ON revisions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- revision_comments (keep public INSERT for client review portal)
DROP POLICY IF EXISTS "Project owners can manage revision comments" ON revision_comments;
CREATE POLICY "Workspace members can manage revision comments" ON revision_comments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM revisions rv
      JOIN projects p ON p.id = rv.project_id
      WHERE rv.id = revision_id AND p.created_by = get_workspace_owner_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM revisions rv
      JOIN projects p ON p.id = rv.project_id
      WHERE rv.id = revision_id AND p.created_by = get_workspace_owner_id()
    )
  );

-- project_files
DROP POLICY IF EXISTS "Users can manage files on their projects"   ON project_files;
CREATE POLICY "Workspace members can manage project files" ON project_files
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- crew_contacts
DROP POLICY IF EXISTS "Users can manage crew on their projects" ON crew_contacts;
CREATE POLICY "Workspace members can manage crew contacts" ON crew_contacts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- project_locations
DROP POLICY IF EXISTS "Users can manage locations on their projects" ON project_locations;
CREATE POLICY "Workspace members can manage project locations" ON project_locations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- wrap_notes
DROP POLICY IF EXISTS "Users can manage wrap notes on their projects" ON wrap_notes;
CREATE POLICY "Workspace members can manage wrap notes" ON wrap_notes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- budget_lines
DROP POLICY IF EXISTS "Users can manage budget lines on their projects" ON budget_lines;
CREATE POLICY "Workspace members can manage budget lines" ON budget_lines
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- project_deliverables
DROP POLICY IF EXISTS "Users can manage deliverables on their projects" ON project_deliverables;
CREATE POLICY "Workspace members can manage project deliverables" ON project_deliverables
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- review_tokens
DROP POLICY IF EXISTS "Users can manage review tokens on their projects" ON review_tokens;
CREATE POLICY "Workspace members can manage review tokens" ON review_tokens
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- activity_log
DROP POLICY IF EXISTS "Users can view activity for their projects" ON activity_log;
CREATE POLICY "Workspace members can view activity" ON activity_log
  FOR SELECT USING (
    project_id IS NULL
    OR EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id())
  );

-- project_tasks
DROP POLICY IF EXISTS "Users can manage their own project tasks" ON project_tasks;
CREATE POLICY "Workspace members can manage project tasks" ON project_tasks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- contracts
DROP POLICY IF EXISTS "Users can manage their own contracts" ON contracts;
CREATE POLICY "Workspace members can view contracts" ON contracts
  FOR SELECT USING (created_by = get_workspace_owner_id());
CREATE POLICY "Workspace owner can insert contracts" ON contracts
  FOR INSERT WITH CHECK (is_workspace_owner());
CREATE POLICY "Workspace members can update contracts" ON contracts
  FOR UPDATE USING (created_by = get_workspace_owner_id());
CREATE POLICY "Workspace owner can delete contracts" ON contracts
  FOR DELETE USING (created_by = get_workspace_owner_id() AND is_workspace_owner());

-- form_responses: update check to use workspace
DROP POLICY IF EXISTS "Form owners can view responses" ON form_responses;
CREATE POLICY "Workspace members can view form responses" ON form_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forms WHERE id = form_id AND created_by = get_workspace_owner_id()
    )
  );

-- shoot_days
DROP POLICY IF EXISTS "Users can manage their own shoot days"          ON shoot_days;
DROP POLICY IF EXISTS "Users can read shoot days for owned projects"   ON shoot_days;
CREATE POLICY "Workspace members can manage shoot days" ON shoot_days
  FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = get_workspace_owner_id()));

-- storyboard_shares
DROP POLICY IF EXISTS "Owners can manage their storyboard shares" ON storyboard_shares;
CREATE POLICY "Workspace members can manage storyboard shares" ON storyboard_shares
  FOR ALL
  USING (created_by = get_workspace_owner_id())
  WITH CHECK (is_workspace_owner() OR created_by = auth.uid());

-- ─── 5. Top-level owned tables ────────────────────────────────────────────────

-- calendar_events
DROP POLICY IF EXISTS "Users can manage their own calendar events" ON calendar_events;
CREATE POLICY "Workspace members can view calendar events" ON calendar_events
  FOR SELECT USING (created_by = get_workspace_owner_id());
CREATE POLICY "Workspace members can insert calendar events" ON calendar_events
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Workspace members can update calendar events" ON calendar_events
  FOR UPDATE USING (created_by = get_workspace_owner_id());
CREATE POLICY "Workspace owner can delete calendar events" ON calendar_events
  FOR DELETE USING (created_by = get_workspace_owner_id());

-- invoices
DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
CREATE POLICY "Workspace members can view invoices" ON invoices
  FOR SELECT USING (created_by = get_workspace_owner_id());
CREATE POLICY "Workspace owner can insert invoices" ON invoices
  FOR INSERT WITH CHECK (is_workspace_owner());
CREATE POLICY "Workspace members can update invoices" ON invoices
  FOR UPDATE USING (created_by = get_workspace_owner_id());
CREATE POLICY "Workspace owner can delete invoices" ON invoices
  FOR DELETE USING (created_by = get_workspace_owner_id() AND is_workspace_owner());

-- client_contacts
DROP POLICY IF EXISTS "Users can manage their own client contacts" ON client_contacts;
CREATE POLICY "Workspace members can view client contacts" ON client_contacts
  FOR SELECT USING (user_id = get_workspace_owner_id());
CREATE POLICY "Workspace owner can manage client contacts" ON client_contacts
  FOR ALL USING (user_id = get_workspace_owner_id() AND is_workspace_owner())
  WITH CHECK (user_id = get_workspace_owner_id() AND is_workspace_owner());

-- ─── 6. team_members — add member self-read + update (for accepting invites) ──

-- Members can view their own workspace's team
CREATE POLICY "Workspace members can view team" ON team_members
  FOR SELECT USING (
    invited_by = get_workspace_owner_id()
    OR user_id = auth.uid()
  );

-- Members can update their own record (e.g. accepting invite marks as active)
CREATE POLICY "Members can update their own invite record" ON team_members
  FOR UPDATE USING (user_id = auth.uid());

-- ─── 7. profiles — workspace members can read each other's profiles ───────────
-- (The existing scoped policy from fix_profiles_rls.sql covers this via
--  team_members join; adding a simpler workspace-aware path.)

CREATE POLICY "Workspace members can read workspace profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    workspace_id = get_workspace_owner_id()
    OR id = get_workspace_owner_id()
  );
