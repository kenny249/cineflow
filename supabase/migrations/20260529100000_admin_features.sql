-- Admin features migration
-- Tables: utm_events, admin_notes, admin_audit_log, feature_flags, announcements
-- Column: profiles.admin_role, profiles.utm_source/medium/campaign/referral_code

-- ─── UTM attribution on profiles ────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS utm_source    TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium    TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign  TEXT,
  ADD COLUMN IF NOT EXISTS utm_content   TEXT,
  ADD COLUMN IF NOT EXISTS utm_term      TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ─── Staff role on profiles ─────────────────────────────────────────────────
-- Values: null (regular user), 'support', 'finance', 'super_admin'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_role TEXT;

-- ─── Admin notes on users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_notes_user_id_idx ON admin_notes (user_id);

ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
-- Only service role (admin API routes) can access — no user-facing policies needed

-- ─── Admin audit log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL,
  action      TEXT NOT NULL,
  target_id   UUID,
  target_type TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx  ON admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_time_idx   ON admin_audit_log (created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ─── Feature flags ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  -- Optional: comma-separated user IDs for targeted rollout
  user_ids    TEXT[],
  -- Optional: plans to enable for ('solo','studio','agency','enterprise')
  plans       TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
-- Readable by authenticated users (needed for client-side flag checks)
CREATE POLICY "feature_flags_read" ON feature_flags
  FOR SELECT TO authenticated USING (true);

-- ─── Announcements ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'success'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  -- Target: null = all users, or restrict by plan
  plans       TEXT[],
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
-- Users can read active announcements
CREATE POLICY "announcements_read" ON announcements
  FOR SELECT TO authenticated USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
