-- ============================================================
-- Private Beta Hardening
-- Replaces all dev-open "USING (true)" policies with
-- user-scoped policies tied to auth.uid().
--
-- Isolation model:
--   A user can see/edit any row they created (created_by = auth.uid()).
--   If a row has project_id, they must also own/be-member of that project.
--   Review tokens, invoices, beta_feedback remain auth-only (any logged-in
--   user can reach the shared review portal via token, which is intentional).
-- ============================================================

-- ─── Helper function ─────────────────────────────────────────────────────────
-- Returns true if auth.uid() is a member (any role) of the given project.
CREATE OR REPLACE FUNCTION user_is_project_member(pid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = pid
      AND user_id = auth.uid()
  );
$$;

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Policies already correct from initial schema; leave alone.

-- ─── projects ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on projects for development" ON projects;

CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (created_by = auth.uid());

-- ─── project_members ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on project_members for development" ON project_members;

CREATE POLICY "Members can view project_members for their projects" ON project_members
  FOR SELECT USING (user_is_project_member(project_id));

CREATE POLICY "Project owners can insert project_members" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

CREATE POLICY "Project owners can delete project_members" ON project_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── project_notes ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on project_notes for development" ON project_notes;

CREATE POLICY "Users can manage notes on their projects" ON project_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── shot_lists ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on shot_lists for development" ON shot_lists;

CREATE POLICY "Users can manage shot_lists on their projects" ON shot_lists
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── shot_list_items ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on shot_list_items for development" ON shot_list_items;

CREATE POLICY "Users can manage shot_list_items via their shot lists" ON shot_list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shot_lists sl
      JOIN projects p ON p.id = sl.project_id
      WHERE sl.id = shot_list_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shot_lists sl
      JOIN projects p ON p.id = sl.project_id
      WHERE sl.id = shot_list_id
        AND p.created_by = auth.uid()
    )
  );

-- ─── storyboard_frames ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on storyboard_frames for development" ON storyboard_frames;

CREATE POLICY "Users can manage storyboard_frames on their projects" ON storyboard_frames
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── revisions ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on revisions for development" ON revisions;

CREATE POLICY "Users can manage revisions on their projects" ON revisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── revision_comments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all operations on revision_comments for development" ON revision_comments;

-- Owners can fully manage comments on their project revisions
CREATE POLICY "Project owners can manage revision comments" ON revision_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM revisions rv
      JOIN projects p ON p.id = rv.project_id
      WHERE rv.id = revision_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM revisions rv
      JOIN projects p ON p.id = rv.project_id
      WHERE rv.id = revision_id
        AND p.created_by = auth.uid()
    )
  );

-- Unauthenticated/anon can INSERT comments via review portal (token-protected at app layer)
CREATE POLICY "Anyone can post revision comments" ON revision_comments
  FOR INSERT WITH CHECK (true);

-- ─── calendar_events ─────────────────────────────────────────────────────────
-- calendar_events can be standalone (no project_id) or project-linked
DROP POLICY IF EXISTS "Allow all operations on calendar_events for development" ON calendar_events;

CREATE POLICY "Users can manage their own calendar events" ON calendar_events
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ─── team_members ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on team_members" ON team_members;

-- invited_by tracks the workspace owner; scope to that user's workspace
CREATE POLICY "Workspace owners can manage team members they invited" ON team_members
  FOR ALL USING (invited_by = auth.uid())
  WITH CHECK (invited_by = auth.uid());

-- The invited user can see their own invite
CREATE POLICY "Team members can view their own invite" ON team_members
  FOR SELECT USING (user_id = auth.uid());

-- ─── team_topics ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on team_topics" ON team_topics;

CREATE POLICY "Authenticated users can manage team topics" ON team_topics
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── team_messages ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on team_messages" ON team_messages;

CREATE POLICY "Authenticated users can send and view messages" ON team_messages
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── project_files ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all project_files" ON project_files;

CREATE POLICY "Users can manage files on their projects" ON project_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── crew_contacts ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all crew_contacts" ON crew_contacts;

CREATE POLICY "Users can manage crew on their projects" ON crew_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── project_locations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all project_locations" ON project_locations;

CREATE POLICY "Users can manage locations on their projects" ON project_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── wrap_notes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all wrap_notes" ON wrap_notes;

CREATE POLICY "Users can manage wrap notes on their projects" ON wrap_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── budget_lines ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated users can manage budget lines" ON budget_lines;

CREATE POLICY "Users can manage budget lines on their projects" ON budget_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- ─── invoices ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated can manage invoices" ON invoices;

CREATE POLICY "Users can manage their own invoices" ON invoices
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ─── review_tokens ───────────────────────────────────────────────────────────
-- review_tokens already scoped by token lookup at app layer; allow auth users to manage
DROP POLICY IF EXISTS "Allow all review_tokens" ON review_tokens;

CREATE POLICY "Users can manage review tokens on their projects" ON review_tokens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- Public SELECT for active tokens (review portal uses anon key to look up by token)
CREATE POLICY "Anyone can view active review tokens" ON review_tokens
  FOR SELECT USING (is_active = true);

-- ─── activity_log ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all activity_log" ON activity_log;

CREATE POLICY "Users can view activity for their projects" ON activity_log
  FOR SELECT USING (
    project_id IS NULL
    OR EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

CREATE POLICY "Authenticated users can insert activity" ON activity_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── client_contacts table (new) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_contacts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_name  TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  website      TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, client_name)
);

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own client contacts" ON client_contacts
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER client_contacts_updated_at
  BEFORE UPDATE ON client_contacts
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── project_deliverables table (new) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_deliverables (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  label      TEXT NOT NULL,
  done       BOOLEAN DEFAULT false NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE project_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage deliverables on their projects" ON project_deliverables
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND created_by = auth.uid())
  );

-- Public read via review portal (anon key)
CREATE POLICY "Anyone can view project deliverables" ON project_deliverables
  FOR SELECT USING (true);
