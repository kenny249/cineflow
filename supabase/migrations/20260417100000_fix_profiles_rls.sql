-- Fix profiles_select: was USING (true) — any authenticated user could read
-- every other user's profile. Replace with scoped access:
--   1. Own profile (always)
--   2. Profiles of team members in your workspace
--   3. Profiles of collaborators on shared projects

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "Users can read relevant profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Own profile
    id = auth.uid()
    OR
    -- Team members you invited
    id IN (
      SELECT user_id FROM team_members WHERE invited_by = auth.uid()
    )
    OR
    -- Users who invited you to their team
    id IN (
      SELECT invited_by FROM team_members WHERE user_id = auth.uid()
    )
    OR
    -- Collaborators on shared projects
    id IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- ─── Intentionally open policies (documented for clarity) ────────────────────
-- The following WITH CHECK (true) / USING (true) policies are correct by design:
--
--   contract_signatures INSERT WITH CHECK (true)
--     Clients sign contracts via a public token link without an account.
--
--   form_responses INSERT WITH CHECK (true)
--     Clients submit forms via a public token link without an account.
--
--   revision_comments INSERT WITH CHECK (true)
--     Clients leave feedback on review links without an account.
--
--   storyboard_shares SELECT USING (true)
--     Public share links must work without login.
--
--   beta_feedback INSERT/SELECT
--     Feedback collection is intentionally open during beta.
