-- Stores IDs of built-in checklist items the user has hidden on a per-project basis.
-- Allows restoring them at any time (non-destructive hide).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS hidden_default_items TEXT[] DEFAULT '{}'::text[];
