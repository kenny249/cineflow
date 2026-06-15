-- Ensure all project columns exist that the app expects.
-- Some were added in earlier migrations that may not have been applied to production.
-- All statements are idempotent (IF NOT EXISTS).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_email      TEXT,
  ADD COLUMN IF NOT EXISTS cover_position    TEXT    DEFAULT '50% 50%',
  ADD COLUMN IF NOT EXISTS custom_type       TEXT,
  ADD COLUMN IF NOT EXISTS client_logo_url   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_platform TEXT,
  ADD COLUMN IF NOT EXISTS delivery_url      TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMP WITH TIME ZONE;

-- Ensure new project_type enum values exist
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'feature_film';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'live_event';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'social_content';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'reality_tv';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'editorial';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'custom';
