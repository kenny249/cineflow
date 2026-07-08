-- Real, identity-based task assignment. Previously project_tasks only had a
-- free-text assignee_name, so "assigned to me" couldn't be queried and the
-- assignee never saw the task. Add a user reference (assignee_name kept for
-- display / non-account assignees).
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee_id);
