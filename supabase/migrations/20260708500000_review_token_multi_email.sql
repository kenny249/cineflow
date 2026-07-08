-- Multi-recipient client portals. Access stays link-based (token); these lists
-- are just who we notify. invited_emails tracks who has actually been sent the
-- invite so "send to new only" works.
ALTER TABLE review_tokens ADD COLUMN IF NOT EXISTS client_emails text[] NOT NULL DEFAULT '{}';
ALTER TABLE review_tokens ADD COLUMN IF NOT EXISTS invited_emails text[] NOT NULL DEFAULT '{}';

-- Seed the list from the existing single email; treat it as already invited.
UPDATE review_tokens SET client_emails = ARRAY[client_email]
  WHERE client_email IS NOT NULL AND client_email <> '' AND cardinality(client_emails) = 0;
UPDATE review_tokens SET invited_emails = client_emails
  WHERE cardinality(invited_emails) = 0 AND cardinality(client_emails) > 0;
