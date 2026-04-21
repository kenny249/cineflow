-- Fix: project_tasks RLS blocked tasks with no project (project_id IS NULL)
-- The workspace migration required project_id to be non-null, breaking standalone tasks.
-- New policy: allow if created_by = workspace owner (covers null project_id),
-- OR if task belongs to a project owned by the workspace.

DROP POLICY IF EXISTS "Workspace members can manage project tasks" ON project_tasks;

CREATE POLICY "Workspace members can manage project tasks" ON project_tasks
  FOR ALL
  USING (
    created_by = get_workspace_owner_id()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id
          AND created_by = get_workspace_owner_id()
      )
    )
  )
  WITH CHECK (
    created_by = get_workspace_owner_id()
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id
          AND created_by = get_workspace_owner_id()
      )
    )
  );

-- Add delivered_via columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS delivery_platform TEXT,
  ADD COLUMN IF NOT EXISTS delivery_url      TEXT;

-- Add payment_schedule to invoices
-- Each entry: { id, label, amount, due_date, status: 'unpaid'|'paid', paid_at }
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_schedule JSONB;
