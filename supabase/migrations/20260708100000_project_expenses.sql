-- Persist project expenses in the DB (were previously localStorage-only, so they
-- were lost across devices/browsers and invisible to collaborators).

CREATE TABLE IF NOT EXISTS project_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description    text NOT NULL,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  category       text,
  dept           text,
  payment_method text,
  purchased_by   text,
  expense_date   date,
  reimbursed     boolean NOT NULL DEFAULT false,
  flagged        boolean NOT NULL DEFAULT false,
  receipt_note   text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses(project_id);

ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

-- Owner (created_by) or any project member. Mirrors project_equipment.
DROP POLICY IF EXISTS project_expenses_all ON project_expenses;
CREATE POLICY project_expenses_all ON project_expenses FOR ALL TO authenticated
  USING (
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );
