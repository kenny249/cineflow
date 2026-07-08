-- Audit fixes (2026-07-08) — applied directly to production, recorded here to keep
-- migrations in sync with the live schema.

-- 1. Equipment: the UI offers 11 departments but the original CHECK only allowed 5,
--    so grip/electric/wardrobe/hair_makeup/vehicles/catering inserts silently failed.
ALTER TABLE project_equipment DROP CONSTRAINT IF EXISTS project_equipment_category_check;
ALTER TABLE project_equipment ADD CONSTRAINT project_equipment_category_check
  CHECK (category IN (
    'camera','audio','lighting','support','grip','electric',
    'wardrobe','hair_makeup','vehicles','catering','other'
  ));

-- 2. Backfill project_members owner rows. createProject() now writes these going
--    forward; this covers every existing project.
INSERT INTO project_members (project_id, user_id, role)
  SELECT id, created_by, 'owner' FROM projects WHERE created_by IS NOT NULL
  ON CONFLICT (project_id, user_id) DO NOTHING;

-- 3. budget_lines RLS previously required a project_members row that was never
--    created, locking out even the project owner. Add a created_by fallback.
DROP POLICY IF EXISTS budget_lines_admin_only ON budget_lines;
CREATE POLICY budget_lines_owner_admin ON budget_lines FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = budget_lines.project_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = budget_lines.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = budget_lines.project_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = budget_lines.project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner','admin'))
  );
