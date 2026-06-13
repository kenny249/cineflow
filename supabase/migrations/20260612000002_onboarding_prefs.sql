ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_role    text,
  ADD COLUMN IF NOT EXISTS content_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS team_size    text,
  ADD COLUMN IF NOT EXISTS uses_drone   boolean DEFAULT false;
