-- Drop FK constraints on team tables that reference profiles.
-- These prevent inserts when a user has no profile row yet
-- (profiles are not auto-created on auth signup in this app).

ALTER TABLE team_messages DROP CONSTRAINT IF EXISTS team_messages_author_id_fkey;
ALTER TABLE team_topics   DROP CONSTRAINT IF EXISTS team_topics_created_by_fkey;
ALTER TABLE team_members  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
ALTER TABLE team_members  DROP CONSTRAINT IF EXISTS team_members_invited_by_fkey;
