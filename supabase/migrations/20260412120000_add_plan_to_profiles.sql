-- Add plan/tier column to profiles
-- Values: 'solo_beta' | 'studio_beta' | 'solo_pro' | 'studio_pro'
-- All existing users default to studio_beta (full experience)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'studio_beta';
