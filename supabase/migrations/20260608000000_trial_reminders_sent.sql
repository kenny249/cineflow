-- Track which trial reminder emails have been sent so we never double-send.
-- Values in the array: '7d', '3d', '1d'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_reminders_sent TEXT[] NOT NULL DEFAULT '{}';
