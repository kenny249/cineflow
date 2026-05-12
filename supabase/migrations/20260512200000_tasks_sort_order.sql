-- Add sort_order to daily tasks for manual drag-to-reorder
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill: set sort_order based on created_at within each user+date group
UPDATE tasks t
SET sort_order = sub.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY user_id, date ORDER BY created_at) - 1 AS rn
  FROM tasks
) sub
WHERE t.id = sub.id;
