-- ─── Project cover repositioning, custom type, and client logo ────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cover_position  TEXT    DEFAULT '50% 50%',
  ADD COLUMN IF NOT EXISTS custom_type     TEXT,
  ADD COLUMN IF NOT EXISTS client_logo_url TEXT;
