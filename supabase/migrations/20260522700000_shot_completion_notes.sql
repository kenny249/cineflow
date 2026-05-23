-- ── Shot completion notes + note author names ────────────────────────────────

-- On-set note from collaborator when marking a shot done
ALTER TABLE shot_list_items
  ADD COLUMN IF NOT EXISTS completion_note text;

-- Author display name stored at write time (avoids joins on read)
ALTER TABLE project_notes
  ADD COLUMN IF NOT EXISTS author_name text;
