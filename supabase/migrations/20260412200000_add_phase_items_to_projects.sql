-- Add phase_items column to projects table
-- Stores the checked production phase item IDs so progress survives
-- across browsers/devices instead of relying on localStorage only.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS phase_items text[] NOT NULL DEFAULT '{}';
