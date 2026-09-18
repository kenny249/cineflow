-- "Members can update their own invite record" (20260417200000) lets a team
-- member UPDATE their own team_members row with no WITH CHECK, which Postgres
-- then defaults to the USING clause (user_id = auth.uid()) for the post-update
-- row too. Since that stays true no matter what else changes, a member can
-- run `UPDATE team_members SET role = 'owner' WHERE user_id = auth.uid()`
-- directly against the DB and it passes RLS — confirmed live 2026-09-18 with a
-- throwaway test account. RLS can't compare OLD vs NEW column values on its
-- own, so this needs a trigger rather than a stricter WITH CHECK.

CREATE OR REPLACE FUNCTION prevent_member_self_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_workspace_owner() THEN
    RAISE EXCEPTION 'Only the workspace owner can change a team member''s role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_self_role_change ON team_members;

CREATE TRIGGER trg_prevent_member_self_role_change
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_member_self_role_change();
