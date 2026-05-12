-- ── Role enforcement for workspace team members ──────────────────────────────
--
-- Adds two helper functions used across all role-gated policies:
--   get_member_role()      → 'owner' | 'admin' | 'member'
--   is_producer_or_above() → true for owner and admin roles
--
-- Then tightens RLS on financial tables so plain members can never
-- read budget or invoice data, even via direct API calls.

-- ── Helper: current user's role ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_member_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN is_workspace_owner() THEN 'owner'
    ELSE COALESCE(
      (SELECT role FROM team_members
       WHERE user_id        = auth.uid()
         AND invited_by     = get_workspace_owner_id()
         AND status         = 'active'
       LIMIT 1),
      'member'
    )
  END
$$;

-- ── Helper: owner or admin (Producer) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_producer_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_member_role() IN ('owner', 'admin')
$$;

-- ── budget_lines: producer/owner only ─────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can manage budget lines" ON budget_lines;

CREATE POLICY "Producers can manage budget lines" ON budget_lines
  FOR ALL
  USING (
    is_producer_or_above()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND created_by = get_workspace_owner_id()
    )
  )
  WITH CHECK (
    is_producer_or_above()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND created_by = get_workspace_owner_id()
    )
  );

-- ── invoices: producer/owner only ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can view invoices"   ON invoices;
DROP POLICY IF EXISTS "Workspace owner can insert invoices"   ON invoices;
DROP POLICY IF EXISTS "Workspace members can update invoices" ON invoices;
DROP POLICY IF EXISTS "Workspace owner can delete invoices"   ON invoices;

CREATE POLICY "Producers can view invoices" ON invoices
  FOR SELECT
  USING (is_producer_or_above() AND created_by = get_workspace_owner_id());

CREATE POLICY "Producers can insert invoices" ON invoices
  FOR INSERT
  WITH CHECK (is_producer_or_above() AND created_by = auth.uid());

CREATE POLICY "Producers can update invoices" ON invoices
  FOR UPDATE
  USING (is_producer_or_above() AND created_by = get_workspace_owner_id());

CREATE POLICY "Owner can delete invoices" ON invoices
  FOR DELETE
  USING (is_workspace_owner() AND created_by = get_workspace_owner_id());
