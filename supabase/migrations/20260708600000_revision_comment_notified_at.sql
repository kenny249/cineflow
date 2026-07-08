-- Tracks whether a client comment has already been included in an owner email
-- (either bundled into an Approve/Request Changes email, or a daily digest for
-- comments that never got a formal action). Prevents duplicate/flooding emails
-- while still guaranteeing nothing gets silently missed.
ALTER TABLE revision_comments ADD COLUMN IF NOT EXISTS notified_at timestamptz;
