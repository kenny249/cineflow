-- Add customizable quick actions to profiles (null = use app defaults)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_actions TEXT[] DEFAULT NULL;
