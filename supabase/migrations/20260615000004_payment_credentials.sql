-- Move sensitive API keys out of profiles.payment_settings (readable by collaborators)
-- into a dedicated table with owner-only RLS.
-- Non-sensitive payment settings (Zelle, ACH, PayPal, etc.) stay in profiles.

CREATE TABLE IF NOT EXISTS payment_credentials (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_secret_key  TEXT,
  stripe_webhook_secret TEXT,
  resend_api_key     TEXT,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_owner_only" ON payment_credentials
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migrate existing keys from profiles.payment_settings
INSERT INTO payment_credentials (user_id, stripe_secret_key, stripe_webhook_secret, resend_api_key)
SELECT
  id,
  NULLIF(payment_settings->>'stripe_secret_key', ''),
  NULLIF(payment_settings->>'stripe_webhook_secret', ''),
  NULLIF(payment_settings->>'resend_api_key', '')
FROM profiles
WHERE payment_settings IS NOT NULL
  AND (
    payment_settings->>'stripe_secret_key'   IS NOT NULL
    OR payment_settings->>'stripe_webhook_secret' IS NOT NULL
    OR payment_settings->>'resend_api_key'    IS NOT NULL
  )
ON CONFLICT (user_id) DO UPDATE SET
  stripe_secret_key     = EXCLUDED.stripe_secret_key,
  stripe_webhook_secret = EXCLUDED.stripe_webhook_secret,
  resend_api_key        = EXCLUDED.resend_api_key,
  updated_at            = NOW();

-- Scrub sensitive keys from profiles so collaborators can no longer read them
UPDATE profiles
SET payment_settings = payment_settings
  - 'stripe_secret_key'
  - 'stripe_webhook_secret'
  - 'resend_api_key'
WHERE payment_settings IS NOT NULL;
