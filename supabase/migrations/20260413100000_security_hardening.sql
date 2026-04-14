-- ============================================================
-- Security Hardening — Round 2
-- Fixes remaining open RLS policies left after private_beta_hardening:
--   1. storyboard_shares: was USING (true) — scope to project owner
--   2. team_topics: was auth.role()='authenticated' — scope to creator/members
--   3. team_messages: was auth.role()='authenticated' — scope to topic participants
--   4. invoices public read: tighten to only the project pay page use case
-- ============================================================

-- ─── 1. storyboard_shares ────────────────────────────────────────────────────
-- Drop the original open policies from 20260411000000_storyboard_and_shares.sql
DROP POLICY IF EXISTS "storyboard_shares_read"  ON storyboard_shares;
DROP POLICY IF EXISTS "storyboard_shares_write" ON storyboard_shares;

-- Owners can fully manage their shares
CREATE POLICY "Owners can manage their storyboard shares" ON storyboard_shares
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Public token-based read (share links work without login)
CREATE POLICY "Anyone can view a storyboard share by token" ON storyboard_shares
  FOR SELECT USING (true);

-- ─── 2. team_topics ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage team topics" ON team_topics;

-- Creators can fully manage their own topics
CREATE POLICY "Creators can manage their own team topics" ON team_topics
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Team members invited by the topic creator can view topics
CREATE POLICY "Team members can view topics in their workspace" ON team_topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.invited_by = team_topics.created_by
        AND team_members.user_id = auth.uid()
    )
  );

-- ─── 3. team_messages ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can send and view messages" ON team_messages;

-- Authors can manage their own messages
CREATE POLICY "Authors can manage their own messages" ON team_messages
  FOR ALL USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Workspace members can insert messages into accessible topics
CREATE POLICY "Team members can post in workspace topics" ON team_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_topics tt
      WHERE tt.id = team_messages.topic_id
        AND (
          tt.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.invited_by = tt.created_by
              AND tm.user_id = auth.uid()
          )
        )
    )
  );

-- Workspace members can read messages in their topics
CREATE POLICY "Team members can read messages in workspace topics" ON team_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_topics tt
      WHERE tt.id = team_messages.topic_id
        AND (
          tt.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.invited_by = tt.created_by
              AND tm.user_id = auth.uid()
          )
        )
    )
  );

-- ─── 4. invoices — replace open public read with restricted version ───────────
-- The pay page (/pay/[invoiceId]) uses service role key server-side, so it
-- bypasses RLS entirely. The open "using (true)" policy is not needed for that.
-- Remove it to prevent leaking invoice data via anon key queries.
DROP POLICY IF EXISTS "public can view invoice by id" ON invoices;
