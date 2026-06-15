-- Stores user-defined checklist items per production phase on each project.
-- Structure: [{ phaseId, id, label }]
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS custom_checklist_items JSONB DEFAULT '[]'::jsonb;
