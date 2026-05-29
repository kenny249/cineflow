-- Upgrade invite_links with full customization fields
ALTER TABLE invite_links
  ADD COLUMN IF NOT EXISTS headline     TEXT,
  ADD COLUMN IF NOT EXISTS badge_text   TEXT NOT NULL DEFAULT 'Founding Member',
  ADD COLUMN IF NOT EXISTS subtext      TEXT,
  ADD COLUMN IF NOT EXISTS invitee_name TEXT,
  ADD COLUMN IF NOT EXISTS access_type  TEXT NOT NULL DEFAULT 'founding',
  ADD COLUMN IF NOT EXISTS trial_days   INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT true;

-- Track every signup that came through an invite link
CREATE TABLE IF NOT EXISTS invite_link_uses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_link_id   UUID REFERENCES invite_links(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email            TEXT,
  used_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
