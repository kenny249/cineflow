-- Add Stripe billing columns to profiles.
-- These are required for the webhook, checkout, and settings to work.
-- All existing users get plan_status='trialing' until they subscribe or their trial logic fires.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_interval          TEXT,
  ADD COLUMN IF NOT EXISTS plan_status            TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seat_count             INTEGER NOT NULL DEFAULT 1;
