-- SECURITY: systemic multi-tenancy hardening.
--
-- Several tables had policies that let ANY authenticated user (some even
-- anonymous) read/write ALL rows across every account — cross-tenant leaks of
-- client PII (emails, phones, addresses), file paths, production notes, etc.
--
-- Public/token-gated read paths were moved to the service role first
-- (app/api/review/*, app/review metadata, app/api/storyboard-share GET,
-- app/api/studio-branding, app/api/notify — all use createAdminClient), so RLS
-- no longer needs to expose these tables to anon or non-owner users.
--
-- Each project-scoped table now uses one policy: the caller must own, be a
-- member of, or actively collaborate on the project.

DO $$
DECLARE
  t text;
  p record;
  cond text := '(project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())'
             || ' OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())'
             || ' OR project_id IN (SELECT project_id FROM project_collaborators WHERE user_id = auth.uid() AND status = ''active''))';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crew_contacts','project_files','project_locations','wrap_notes',
    'storyboard_frames','project_deliverables'
  ] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING %s WITH CHECK %s',
      t || '_scoped', t, cond, cond
    );
  END LOOP;
END $$;

-- activity_log: project_id and user_id are both nullable, so include user_id.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='activity_log' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON activity_log', p.policyname);
  END LOOP;
END $$;
CREATE POLICY activity_log_scoped ON activity_log FOR ALL TO authenticated
  USING (user_id = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- storyboard_shares: public GET now uses the service role; drop the public read.
-- The workspace-scoped management policy remains for the authenticated owner.
DROP POLICY IF EXISTS "Anyone can view a storyboard share by token" ON storyboard_shares;

-- feedback: readable only by admins (admin pages read via the authed client).
-- Submitting feedback (INSERT) stays open via its existing policy.
DROP POLICY IF EXISTS "Authenticated users can read feedback" ON feedback;
CREATE POLICY feedback_admin_read ON feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
