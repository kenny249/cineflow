-- Add show_new_badge to feature_flags so admin can highlight new features in the sidebar
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS show_new_badge boolean DEFAULT false;
