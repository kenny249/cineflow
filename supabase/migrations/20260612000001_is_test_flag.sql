-- Add is_test flag to profiles for marking test/friend accounts
-- These are excluded from public-facing metrics in the Brief tab
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;
