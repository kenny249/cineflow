-- Add 'changes_requested' to revision_status enum (was missing from initial schema)
ALTER TYPE revision_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- Add file metadata columns to revisions (present in TypeScript types, missing from DB)
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add timestamp note support and display name to revision_comments
ALTER TABLE revision_comments ADD COLUMN IF NOT EXISTS timestamp_seconds NUMERIC;
ALTER TABLE revision_comments ADD COLUMN IF NOT EXISTS author_name TEXT;

-- Enable RLS on revision_comments (was omitted from initial migration)
ALTER TABLE revision_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on revision_comments for development" ON revision_comments;
CREATE POLICY "Allow all operations on revision_comments for development"
  ON revision_comments FOR ALL USING (true) WITH CHECK (true);
