-- Feature flags v2: badge expiry, page gating, site maintenance mode

-- 1. Extend feature_flags table
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS gated boolean NOT NULL DEFAULT false;

-- 2. Site settings singleton (maintenance mode + future global settings)
CREATE TABLE IF NOT EXISTS site_settings (
  id int PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'We''re doing some quick maintenance. We''ll be back shortly.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_single_row CHECK (id = 1)
);

INSERT INTO site_settings (id, maintenance_mode, maintenance_message)
VALUES (1, false, 'We''re doing some quick maintenance. We''ll be back shortly.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can touch site_settings (all app access is via service role client)
-- No public RLS policy needed

-- 3. Pre-seed all nav items as feature flags
INSERT INTO feature_flags (key, description, enabled, show_new_badge, gated)
VALUES
  ('dashboard',        'Dashboard overview page',              true, false, false),
  ('projects',         'Projects list and management',         true, false, false),
  ('clients',          'Clients management',                   true, false, false),
  ('retainers',        'Retainer contracts',                   true, false, false),
  ('crew',             'Crew members',                         true, false, false),
  ('calendar',         'Production calendar',                  true, false, false),
  ('boards',           'Kanban production boards',             true, false, false),
  ('storyboard',       'Storyboard creator',                   true, false, false),
  ('shot-lists',       'Shot list builder',                    true, false, false),
  ('scripts',          'Script editor',                        true, false, false),
  ('revisions',        'Video review and revisions',           true, false, false),
  ('project-tasks',    'Project task tracker',                 true, false, false),
  ('tasks',            'Personal to-do list',                  true, false, false),
  ('editor-tools',     'Editor productivity tools',            true, false, false),
  ('drones',           'Drone flight planning',                true, false, false),
  ('contracts',        'Contract builder',                     true, false, false),
  ('forms',            'Client intake forms',                  true, false, false),
  ('finance',          'Income and expense tracking',          true, false, false),
  ('quote-calculator', 'Project quote calculator',             true, false, false),
  ('team',             'Team member management',               true, false, false),
  ('settings',         'Account and studio settings',         true, false, false),
  ('beta-feedback',    'Beta feedback form',                   true, false, false)
ON CONFLICT (key) DO NOTHING;
