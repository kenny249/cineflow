-- Landing page email capture — for visitors who aren't ready to start a
-- trial but want occasional product updates. Deliberately NOT a profiles
-- row or an auth.users account: these people never signed up for
-- anything, they just left an email. Written only via the service-role
-- API route (app/api/newsletter/route.ts); read only via the admin portal.
-- No RLS policies granted — service role bypasses RLS entirely, and this
-- table should never be reachable from the anon/authenticated client.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT NOT NULL DEFAULT 'landing_page',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_created_at_idx
  ON newsletter_subscribers (created_at DESC);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
