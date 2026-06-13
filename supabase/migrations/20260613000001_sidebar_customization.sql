ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sidebar_pins   text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sidebar_hidden text[] DEFAULT '{}';
